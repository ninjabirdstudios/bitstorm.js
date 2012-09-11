/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the BitstormContentServer type and implements the entry
/// point for the Web Worker used to load and cache content in the background.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// The global BitstormStorageAPI object contains the resolved references to
/// the various browser-specific, prefixed API types and entry points.
var BitstormStorageAPI = {
    indexedDB          : null,
    IDBTransaction     : null,
    READ_ONLY          : null,
    READ_WRITE         : null
};
BitstormStorageAPI.indexedDB      = (function ()
    {
        return  window.indexedDB              ||
                window.oIndexedDB             ||
                window.msIndexedDB            ||
                window.mozIndexedDB           ||
                window.webkitIndexedDB;
    })();
BitstormStorageAPI.IDBTransaction = (function ()
    {
        return  window.IDBTransaction         ||
                window.oIDBTransaction        ||
                window.msIDBTransaction       ||
                window.mozIDBTransaction      ||
                window.webkitIDBTransaction;
    })();
BitstormStorageAPI.READ_ONLY  =
    BitstormStorageAPI.IDBTransaction.READ_ONLY  || 'readonly';
BitstormStorageAPI.READ_WRITE =
    BitstormStorageAPI.IDBTransaction.READ_WRITE || 'readwrite';

/// Represents a single outstanding cache request against a BitstormDataStore.
/// @param store The BitstormDataStore instance that issued the request.
/// @param key The name of the resource being requested. This is typically the
/// path and filename to the resource.
/// @param url A URL at which the resource is available if it is not located
/// within the cache.
/// @param type A string specifying the desired interpretation of the data
/// returned by the server. May be one of 'blob', 'json', 'text', 'document'
/// or 'arraybuffer'. An empty string corresponds to 'text'.
/// @return The resource request object.
var BitstormResourceRequest = function (store, key, url, type)
{
    if (!(this instanceof BitstormResourceRequest))
    {
        return new BitstormResourceRequest(store, key, url);
    }
    this.api     = BitstormStorageAPI;
    this.key     = key;
    this.url     = url;
    this.type    = type;
    this.store   = store;
    this.started = false;
    return this;
};
BitstormCore.inherits(BitstormResourceRequest, BitstormEmitter);

/// Attempts to retrieve the resource from the underlying data store. If the
/// resource is not present in the data store, the resource is requested from
/// the server. If the resource is in the cache, the 'data' event is emitted
/// with the data loaded from the cache.
/// @return A reference to the BitstormResourceRequest.
BitstormResourceRequest.prototype.queryDataStore = function ()
{
    var self      = this;
    var db        = this.store.db;
    var api       = this.store.api;
    var txn       = db.transaction(BitstormDataStore.FILEDATA, api.READ_ONLY);
    var req       = txn.objectStore(BitstormDataStore.FILEDATA).get(this.key);
    req.onsuccess = function (e)
        {
            if (req.result !== undefined)
            {
                // the resource is in the cache; return its data.
                self.emit('data', self, req.result);
            }
            else
            {
                // the resource is not in-cache; download and cache it.
                self.downloadData();
            }
        };
    req.onerror   = function (e)
        {
            // the resource is not in the cache; download it.
            self.downloadData();
        };
    return this;
};

/// Attempts to cache downloaded data in the data store. Once the operation
/// completes (whether it is successful or not) the 'data' event is emitted
/// with the downloaded data - the data is not re-loaded from the data store.
/// @param info A ProgressEvent instance specifying the data size.
/// @param data The resource data downloaded from the server.
/// @return A reference to the BitstormResourceRequest.
BitstormResourceRequest.prototype.cacheData = function (info, data)
{
    var self = this;
    var db   = this.store.db;
    var api  = this.store.api;
    var txn  = db.transaction(BitstormDataStore.STORE_NAMES, api.READ_WRITE);
    var meta = {
        key      : this.key,
        type     : this.type,
        size     : info.total,
        modified : Date.now()
    };
    txn.objectStore(BitstormDataStore.METADATA).put(meta, this.key);
    txn.objectStore(BitstormDataStore.FILEDATA).put(data, this.key);
    txn.oncomplete = function (e)
        {
            // the data was written to the cache successfully.
            self.emit('data', self, data);
        };
    txn.onerror    = function (e)
        {
            // data couldn't be written to the cache. non-fatal.
            self.emit('data', self, data);
        };
    return this;
};

/// Attempts to download data from the server and cache it locally. If an
/// error occurs, the 'error' event is emitted with information about the
/// error; otherwise, 'progress' events are emitted as the download progresses.
/// Once the download completes, the data is cached locally before the request
/// is completed and the 'data' event emitted.
/// @return A reference to the BitstormResourceRequest.
BitstormResourceRequest.prototype.downloadData = function ()
{
    var self          = this;
    var xhr           = new XMLHttpRequest();
    xhr.responseType  = this.type;
    xhr.open('GET',     this.url, true);
    xhr.onload        = function (e)
        {
            var stat  = xhr.status;
            if (stat >= 200 && stat < 300)
            {
                // status codes in the 200 range indicate success.
                self.cacheData(e, xhr.response);
            }
            else
            {
                // status codes outside the 200 range indicate an error.
                self.emit('error', self, xhr.statusText);
            }
        };
    xhr.onprogress   = function (e)
        {
            self.emit('progress', self, e);
        };
    xhr.onerror      = function (progress)
        {
            self.emit('error', self, xhr.statusText);
        };
    xhr.send();
    return this;
};

/// Executes the request if it has not already been started.
/// @param checkCache Specify true to first check the cache for the requested
/// data, or false to skip the cache and download the resource directly.
/// @return A reference to the BitstormResourceRequest.
BitstormResourceRequest.prototype.start = function (checkCache)
{
    if (this.started)  return this;
    if (checkCache  != false)
    {
        // query the cache first, and download if not in-cache.
        this.started = true;
        this.queryDataStore();
    }
    else
    {
        // skip the cache check and immediately try downloading.
        this.started = true;
        this.downloadData();
    }
    return this;
}

/// Bits function for the BitstormDataStore type backed by the indexedDB
/// indexedDB set of APIs. See http://www.w3.org/TR/IndexedDB/ for details.
/// This type implements the BitstormEmitter interface.
/// @param name The name of the application data store.
var BitstormDataStore = function (name)
{
    if (!(this instanceof BitstormDataStore))
    {
        return new BitstormDataStore(name);
    }
    this.api     = BitstormStorageAPI; // local alias for BitstormStorageAPI
    this.db      = null;               // the indexedDB database connection
    this.name    = name;               // the name of the data store
    this.ready   = false;              // true if connected to database
    return this;
};
BitstormCore.inherits(BitstormDataStore, BitstormEmitter);

/// The current version of the database schema.
BitstormDataStore.VERSION     = 1;

/// The name of the IDBObjectStore for storing entry metadata.
BitstormDataStore.METADATA    = 'metadata';

/// The name of the IDBObjectStore for storing raw file data.
BitstormDataStore.FILEDATA    = 'filedata';

/// An array of object store names. This is useful when creating transactions.
BitstormDataStore.STORE_NAMES =
[
    BitstormDataStore.METADATA,
    BitstormDataStore.FILEDATA
];

/// Deletes all data stored in a particular data store instance by dropping the
/// underlying database.
/// @param name The name of the data store to delete.
BitstormDataStore.deleteStore = function (name)
{
    BitstormStorageAPI.indexedDB.deleteDatabase(name);
}

/// Creates the underlying IDBObjectStore instances within the data store.
/// This is an internal function not intended for public use.
/// @param db The IDBDatabase object where the object stores will be created.
BitstormDataStore.prototype.createStorageContainers = function (db)
{
    db.createObjectStore(BitstormDataStore.METADATA);
    db.createObjectStore(BitstormDataStore.FILEDATA);
};

/// Handles the onupgradeneeded event raised when the database schema changes.
/// This is an internal function not intended for public use.
/// @param event An event conforming to IDBVersionChangeEvent interface.
BitstormDataStore.prototype.handleUpgrade = function (event)
{
    var  db = event.target.result;    // event.target is the open request.
    this.db = db;
    this.createStorageContainers(db);
};

/// Handles the onerror event raised when the database cannot be opened.
/// This is an internal function not intended for public use.
/// @param event An event conforming to the Event interface.
BitstormDataStore.prototype.handleOpenError = function (event)
{
    var err = event.target.error;    // event.target is the open request.
    this.emit('error', this, err);
};

/// Handles the onsuccess event raised when the database is opened.
/// This is an internal function not intended for public use.
/// @param event An event conforming to the Event interface.
BitstormDataStore.prototype.handleOpenSuccess = function (event)
{
    var  db = event.target.result;    // event.target is the open request.
    this.db = db;
    if  (db.setVersion && db.version != BitstormDataStore.VERSION)
    {
        // workaround for chrome which as of 08-31-12 only
        // supports onupgradeneeded in the dev channel...
        var self      = this;
        var req       = db.setVersion(BitstormDataStore.VERSION);
        req.onsuccess = function (e)
            {
                self.version = req.newVersion || db.version;
                self.createStorageContainers(db);
                req.result.oncomplete = function ()
                    {
                        // @note: req.result is the versionchange transaction.
                        // the version change transaction has completed.
                        self.ready = true;
                        self.emit('ready', self);
                    };
            };
        req.onerror   = function (e)
            {
                self.emit('error', self, req.error);
            };
    }
    else
    {
        // no version upgrade was needed; we are finished.
        this.ready = true;
        this.emit('ready', this);
    }
}

/// Opens a connection to the data store. If an error occurs, the 'error' event
/// is emitted. When the data store is ready, the 'ready' event is emitted.
/// @return A reference to the BitstormDataStore instance.
BitstormDataStore.prototype.open = function ()
{
    var api             = this.api;
    var ver             = BitstormDataStore.VERSION;
    var req             = api.indexedDB.open(this.name, ver);
    req.onupgradeneeded = this.handleUpgrade.bind(this);
    req.onerror         = this.handleOpenError.bind(this);
    req.onsuccess       = this.handleOpenSuccess.bind(this);
    return this;
};

/// Closes the connection to the underlying data store. Any pending operations
/// will complete before the connection is fully closed. Emits the 'closing'
/// event to indicate that no new operations should be started.
/// @return A reference to the BitstormDataStore instance.
BitstormDataStore.prototype.close = function ()
{
    if (this.ready)
    {
        this.ready = false;
        this.emit('closing', this);
        if (this.db) this.db.close();
    }
}

/// Creates a request to resolve a resource against this data store. The
/// request is not started.
/// @param server The URL of the content server to download from if the
/// requested resource does not exist in the data store.
/// @param name The path and filename portion of the resource name.
/// @param responseType A string specifying the desired interpretation of the
/// data returned by the server. May be one of 'blob', 'json', 'text',
/// 'document' or 'arraybuffer'. An empty string corresponds to 'text'.
/// @return A BitstormResourceRequest instance representing the request.
BitstormDataStore.prototype.createRequest = function (server, name, responseType)
{
    var url  = server;
    if (url.length > 0 && url[url.length-1] != '/')
        url += '/';
    url     += name;
    return new BitstormResourceRequest(this, name, url, responseType);
};

/// Constructor function for the BitstormContentServer type, which maintains
/// global state for outstanding content requests and manages background
/// downloading of data files.
var BitstormContentServer = function ()
{
    if (!(this instanceof BitstormContentServer))
    {
        return new BitstormContentServer();
    }
    this.dataStores       = {};   // name => BitstormDataStore
    this.contentServers   = [];   // set of registered content server URLs
    this.addServer('');           // add a server representing our origin
    return this;
};
BitstormCore.inherits(BitstormContentServer, BitstormEmitter);

/// Searches for a content server record based on the server URL.
/// @param url A string specifying the root server URL.
/// @return The server record, or null.
BitstormContentServer.prototype.findContentServer = function (url)
{
    var list   = this.contentServers;
    var count  = list.length;
    for (var i = 0; i < count; ++i)
    {
        if (list[i].serverUrl == url)
            return list[i];
    }
    return null;
};

/// Adds a content server to the list of registered servers.
/// @param url A string specifying the root server URL.
/// @return A reference to the BitstormContentServer instance.
BitstormContentServer.prototype.addContentServer = function (url)
{
    if (this.findContentServer(url) == null)
    {
        this.contentServers.push({
            serverUrl : url,
            loadValue : 0
        });
    }
    return this;
};

/// Removes a content server from the list of registered servers.
/// @param url A string specifying the root server URL.
/// @return A reference to the BitstormContentServer instance.
BitstormContentServer.prototype.removeContentServer = function (url)
{
    var list   = this.contentServers;
    var count  = list.length;
    for (var i = 0; i < count; ++i)
    {
        if (list[i].serverUrl == url)
        {
            this.contentServers.splice(i, 1);
            return this;
        }
    }
    return this;
};

/// Selects a content server URL to use for a content download. The server with
/// the lowest current load value is selected.
/// @return An object with serverUrl and loadValue properties that represent
/// the selected server.
BitstormContentServer.prototype.chooseContentServer = function ()
{
    var list   = this.contentServers;
    var count  = list.length;
    var minid  = 0; // index of the item with the lowest load value
    for (var i = 0; i < count; ++i)
    {
        var lv = list[i].loadValue;
        if (lv == 0)
            return list[i];
        if (lv < minid)
            minid = i;
    }
    if (minid  < count)
        return list[minid];
    else
        return null;
};

/// Requests and begins loading a resource.
/// @param args An object specifying the arguments associated with the request.
/// @param args.requestId An application-defined identifier for the request.
/// This value will be sent back to the application when the request has
/// completed and while it is in-progress.
/// @param args.cacheName A string specifying the name of the opened and ready
/// resource cache. If the cache is unknown or is not ready, an 'error' event
/// is emitted.
/// @param args.preferredServer An optional string value specifying the URL of
/// the server the client prefers to use to satisfy the resource request. An
/// empty string maps to the origin of the application. If this argument is not
/// specified, the server with the lowest estimated load value is selected.
/// @param args.resourceName A string specifying the relative path and filename
/// of the resource being requested. The path is specified relative to the
/// server URL registered previously.
/// @param args.responseType A string specifying the desired interpretation of
/// the data returned by the server. May be one of 'blob', 'json', 'text'
/// 'document' or 'arraybuffer'. If unspecified, the default is 'arraybuffer'.
/// @param args.returnCached A boolean value. If true, and the resource exists
/// in the cache, the cached copy is returned. If false, the resource is always
/// downloaded from the network.
/// @return An instance of BitstormResourceRequest representing the request.
BitstormContentServer.prototype.requestResource = function (args)
{
    var requestId       = args.requestId;
    var cacheName       = args.cacheName;
    var preferredServer = args.preferredServer;
    var resourceName    = args.resourceName;
    var responseType    = args.responseType || 'arraybuffer';
    var returnCached    = args.returnCached;
    var dataStore       = this.dataStores[cacheName];
    var serverRecord    = null;
    var request         = null;

    if (!dataStore || !dataStore.ready)
    {
        this.emit('error', this, 'Cache '+cacheName+' is not ready.', requestId);
        return null;
    }
    if (preferredServer)
    {
        // search for the preferred server. if not found, we will
        // choose the server with the lowest estimated load factor.
        serverRecord     = this.findContentServer(preferredServer);
    }
    serverRecord         = serverRecord || this.chooseContentServer();
    request              = dataStore.createRequest(
        serverRecord.serverUrl,
        resourceName,
        responseType);
    request.server       = serverRecord;
    request.clientId     = requestId;
    request.on('data',     this.handleRequestData.bind(this));
    request.on('error',    this.handleRequestError.bind(this));
    request.on('progress', this.handleRequestProgress.bind(this));
    // increase the load on the server that is satisfying the request,
    // and then start the request immediately.
    serverRecord.loadValue++;
    return request.start(returnCached);
};

/// Opens an existing named data store, or creates a new one if none with the
/// specified name exists.
/// @param name The name of the data store to create or open.
/// @return A reference to the BitstormContentServer.
BitstormContentServer.prototype.createDataStore = function (name)
{
    var dataStore = this.dataStores[name];
    if (dataStore)  return this;
    dataStore = new BitstormDataStore(name);
    dataStore.on('ready',   this.handleDataStoreReady.bind(this));
    dataStore.on('error',   this.handleDataStoreError.bind(this));
    dataStore.on('closing', this.handleDataStoreClosing.bind(this));
    dataStore.open();
    return this;
};

/// Queues a data store for deletion. The data store is deleted in its entirety
/// as soon as all open connections have been closed. If the data store is
/// currently open, its connection is closed after any pending operations have
/// been completed.
/// @param name The name of the data store to close and delete.
/// @return A reference to the BitstormContentServer.
BitstormContentServer.prototype.deleteDataStore = function (name)
{
    var dataStore = this.dataStores[name];
    if (dataStore)  dataStore.close();
    BitstormDataStore.deleteStore(name);
    return this;
}

/// Handles the notification from a BitstormDataStore that it is ready to
/// be accessed for queries and caching.
/// @param store The BitstormDataStore instance that raised the event.
BitstormContentServer.prototype.handleDataStoreReady = function (store)
{
    // store the data store in our map.
    this.dataStores[store.name] = store;
    // emit the CACHE_READY message to notify the client.
    this.emit('message', this, {
        id    : BitstormContentClientCommand.CACHE_READY,
        name  : store.name
    });
};

/// Handles the notification from a BitstormDataStore that an error occurred.
/// @param store The BitstormDataStore instance that raised the event.
/// @param error Information about the error that occurred.
BitstormContentServer.prototype.handleDataStoreError = function (store, error)
{
    this.emit('error', this, error);
};

/// Handles the notification from a BitstormDataStore that it is closing and
/// is no longer safe to access.
/// @param store The BitstormDataStore instance that raised the event.
BitstormContentServer.prototype.handleDataStoreClosing = function (store)
{
    // remove the named field from our map.
    // the next time someone tries to access
    // it, the store will be re-opened.
    delete this.dataStores[store.name];
};

/// Handles notification from a BitstormResourceRequest instance that the data
/// has been retrieved, either from the cache or from the server.
/// @param req The BitstormResourceRequest instance that raised the event.
/// @param data The requested data. This may be an object, an ArrayBuffer, etc.
BitstormContentServer.prototype.handleRequestData = function (req, data)
{
    // the request has completed; no additional events will be received.
    req.removeAllListeners();
    // the request has completed, so decrease the server load estimate.
    req.server.loadValue--;
    // pass the data back to the client.
    this.emit('message', this, {
        id             : BitstormContentClientCommand.RESOURCE_DATA,
        requestId      : req.clientId,
        resourceUrl    : req.url,
        resourceName   : req.key,
        resourceData   : data,
        resourceType   : req.type
    });
};

/// Handles notification from a BitstormResourceRequest instance that an error
/// occurred while downloading data from the server.
/// @param req The BitstormResourceRequest instance that raised the event.
/// @param error Status text describing the error.
BitstormContentServer.prototype.handleRequestError = function (req, error)
{
    // the request has completed; no additional events will be received.
    req.removeAllListeners();
    // the request has completed, so decrease the server load estimate.
    req.server.loadValue--;
    // pass the error back to the client.
    this.emit('error', this, error, req.clientId);
};

/// Handles notification from a BitstormResourceRequest instance that progress
/// has been made while downloading data from the server.
/// @param req The BitstormResourceRequest instance that raised the event.
/// @param info A ProgressEvent instance containing download progress.
BitstormContentServer.prototype.handleRequestProgress = function (req, info)
{
    var percent = 0;
    if (info && info.lengthComputable)
    {
        // compute an actual percentage value in [0, 100].
        percent = (info.loaded / info.total) * 100;
    }
    else
    {
        // Windows-style; jump to 99% and make them wait.
        percent = 99;
    }
    this.emit('message', this, {
        id             : BitstormContentClientCommand.PROGRESS,
        requestId      : req.clientId,
        progress       : percent
    });
};

/// Handles a message received from a BitstormContentClient instance.
/// @param data The message data received from the client.
BitstormContentServer.prototype.handleClientMessage = function (data)
{
    var IDs = BitstormContentServerCommand;
    switch (data.id)
    {
        case IDs.ADD_SERVER:
            this.addServer(data.url);
            break;
        case IDs.REMOVE_SERVER:
            this.removeServer(data.url);
            break;
        case IDs.OPEN_CACHE:
            this.createDataStore(data.name);
            break;
        case IDs.DELETE_CACHE:
            this.deleteDataStore(data.name);
            break;
        case IDs.GET_RESOURCE:
            this.requestResource(data);
            break;
        default:
            break;
    }
};
