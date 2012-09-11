/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the BitstormContentClient type which manages content
/// downloads and unpacking of resource archives.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// Constructor function for a type that communicates with a content server
/// running in the background as a Web Worker.
/// @return A reference to the BitstormContentServerWorker.
var BitstormContentServerWorker = function ()
{
    if (!(this instanceof BitstormContentServerWorker))
    {
        return new BitstormContentServerWorker();
    }
    this.basePath   =  bitstorm.scriptPath;
    this.workerFile = 'bitstorm.content.worker.js';
    this.workerPath =  this.basePath + this.workerFile;
    this.worker     =  null;
    return this;
};
BitstormCore.inherits(BitstormContentServerWorker, BitstormEmitter);

/// Starts the content server running on a background thread.
/// @return A reference to the BitstormContentServerWorker.
BitstormContentServerWorker.prototype.startup = function ()
{
    this.worker           = new Worker(this.workerPath);
    this.worker.onmessage = this.handleServerMessage.bind(this);
    return this;
};

/// Immediately terminates the content server and background thread. Any
/// pending requests are cancelled.
/// @return A reference to the BitstormContentServerWorker.
BitstormContentServerWorker.prototype.shutdown = function ()
{
    if (this.worker)
    {
        this.worker.terminate();
        this.worker = null;
    }
    return this;
};

/// Handles a message received from the content server's worker thread. This is
/// an internal method that is not part of the public API.
/// @param event An Event whose data field specifies the message object.
BitstormContentServerWorker.prototype.handleServerMessage = function (event)
{
    var IDs = BitstormContentClientCommand;
    var msg = event.data;
    switch (msg.id)
    {
        case IDs.ERROR:
            this.emit('error', msg);
            break;
        case IDs.CACHE_READY:
            this.emit('ready', msg);
            break;
        case IDs.PROGRESS:
            this.emit('progress', msg);
            break;
        case IDs.RESOURCE_DATA:
            this.emit('resource', msg);
            break;
        default:
            break;
    }
};

/// Adds a URL to the list of servers used for downloading application
/// resources, allowing multiple resources to be downloaded in parallel.
/// @param url The URL of the content server to add. If the origin is not the
/// same as that of the requestor, the server must support CORS.
BitstormContentServerWorker.prototype.addServer = function (url)
{
    this.worker.postMessage({
        id  : BitstormContentServerCommand.ADD_SERVER,
        url : url
    });
};

/// Removes a URL from the list of servers used for downloading application
/// resources. Any pending requests against this server will not be cancelled.
/// @param url The URL of the content server to remove.
BitstormContentServerWorker.prototype.removeServer = function (url)
{
    this.worker.postMessage({
        id  : BitstormContentServerCommand.REMOVE_SERVER,
        url : url
    });
};

/// Requests that a named application cache be opened or created. Caches are
/// used for caching resources on the client. When the cache becomes available
/// a 'ready' event is emitted.
/// @param cacheName A string specifying the name of the application cache.
BitstormContentServerWorker.prototype.openCache = function (cacheName)
{
    this.worker.postMessage({
        id   : BitstormContentServerCommand.OPEN_CACHE,
        name : cacheName
    });
};

/// Requests that a named application cache have its current contents deleted.
/// After deleting a cache, resources will be requested from the server.
/// @param cacheName A string specifying the name of the application cache.
BitstormContentServerWorker.prototype.deleteCache = function (cacheName)
{
    this.worker.postMessage({
        id   : BitstormContentServerCommand.DELETE_CACHE,
        name : cacheName
    });
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
BitstormContentServerWorker.prototype.requestResource = function (args)
{
    this.worker.postMessage({
        id                  : BitstormContentServerCommand.GET_RESOURCE,
        requestId           : args.requestId,
        cacheName           : args.cacheName,
        preferredServer     : args.preferredServer,
        resourceName        : args.resourceName,
        responseType        : args.responseType,
        returnCached        : args.returnCached
    });
};

/// Constructor function for a type that communicates with a content server
/// running locally, on the same thread as the rest of the application.
/// @return A reference to the BitstormContentServerLocal.
var BitstormContentServerLocal = function ()
{
    if (!(this instanceof BitstormContentServerLocal))
    {
        return new BitstormContentServerLocal();
    }
    this.server = new BitstormContentServer();
    this.server.on('error',   this.handleError.bind(this));
    this.server.on('message', this.handleMessage.bind(this));
    return this;
};
BitstormCore.inherits(BitstormContentServerLocal, BitstormEmitter);

/// Performs any operations necessary to initialize the content server.
/// @return A reference to the BitstormContentServerLocal.
BitstormContentServerLocal.prototype.startup = function ()
{
    return this;
};

/// Immediately terminates the content server and background thread.
/// @return A reference to the BitstormContentServerLocal.
BitstormContentServerLocal.prototype.shutdown = function ()
{
    // @todo: behavior needs to be normalized.
    return this;
};

/// Adds a URL to the list of servers used for downloading application
/// resources, allowing multiple resources to be downloaded in parallel.
/// @param url The URL of the content server to add. If the origin is not the
/// same as that of the requestor, the server must support CORS.
BitstormContentServerLocal.prototype.addServer = function (url)
{
    this.server.addContentServer(url);
};

/// Removes a URL from the list of servers used for downloading application
/// resources. Any pending requests against this server will not be cancelled.
/// @param url The URL of the content server to remove.
BitstormContentServerLocal.prototype.removeServer = function (url)
{
    this.server.removeContentServer(url);
};

/// Requests that a named application cache be opened or created. Caches are
/// used for caching resources on the client. When the cache becomes available
/// a 'ready' event is emitted.
/// @param cacheName A string specifying the name of the application cache.
BitstormContentServerLocal.prototype.openCache = function (cacheName)
{
    this.server.createDataStore(cacheName);
};

/// Requests that a named application cache have its current contents deleted.
/// After deleting a cache, resources will be requested from the server.
/// @param cacheName A string specifying the name of the application cache.
BitstormContentServerLocal.prototype.deleteCache = function (cacheName)
{
    this.server.deleteDataStore(cacheName);
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
BitstormContentServerLocal.prototype.requestResource = function (args)
{
    this.server.requestResource(args);
};

/// Handles an error event raised by the server.
/// @param sender The BitstormContentServer instance that raised the event.
/// @param error A string describing the error.
/// @param id The client-supplied request identifier.
BitstormContentServerLocal.prototype.handleError = function (sender, error, id)
{
    this.emit('error', {
        requestId : id,
        error     : error
    });
};

/// Handles a message event raised by the server.
/// @param sender The BitstormContentServer instance that raised the event.
/// @param data The data associated with the message.
BitstormContentServerLocal.prototype.handleMessage = function (sender, data)
{
    var IDs = BitstormContentClientCommand;
    switch (data.id)
    {
        case IDs.ERROR:
            this.emit('error', data);
            break;
        case IDs.CACHE_READY:
            this.emit('ready', data);
            break;
        case IDs.PROGRESS:
            this.emit('progress', data);
            break;
        case IDs.RESOURCE_DATA:
            this.emit('resource', data);
            break;
        default:
            break;
    }
};

/// Constructor function for the BitstormContentClient type, which maintains
/// global state for outstanding content requests and manages background
/// downloading of data files.
var BitstormContentClient = function ()
{
    if (!(this instanceof BitstormContentClient))
    {
        return new BitstormContentClient();
    }
    this.serverThread = null;
    return this;
};
BitstormCore.inherits(BitstormContentClient, BitstormEmitter);
