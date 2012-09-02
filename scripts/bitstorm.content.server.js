/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the BitstormContentServer type and implements the entry
/// point for the Web Worker used to load and cache content in the background.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
importScripts(
    'bitstorm.core.js',
    'bitstorm.content.shared.js'
);

/// Constructor function for the BitstormContentServer type, which maintains
/// global state for outstanding content requests and manages background
/// downloading of data files.
var BitstormContentServer = function ()
{
    if (!(this instanceof BitstormContentServer))
    {
        return new BitstormContentServer();
    }
    this.nextServerIndex  = 0;
    this.contentServers   = [];
    this.pendingRequests  = [];
    this.dataStores       = {};
    return this;
};
BitstormCore.inherits(BitstormContentServer, BitstormEmitter);

/// Adds a content server to the list of registered servers.
/// @param url A string specifying the root server url.
/// @return A reference to the BitstormContentServer instance.
BitstormContentServer.prototype.addServer = function (url)
{
    this.contentServers.push(url);
    return this;
};

/// Removes a content server from the list of registered servers.
/// @param url A string specifying the root server url.
/// @return A reference to the BitstormContentServer instance.
BitstormContentServer.prototype.removeServer = function (url)
{
    var index  = this.contentServers.indexOf(url);
    if (index >= 0) this.contentServers.splice(index, 1);
    return this;
};

/*/////////////////////////////////////////////////////////////////////////80*/
/*/////////////////////////////////////////////////////////////////////////80*/

/// The global content server instance.
var  server     = new BitstormContentServer();

/// Handles messages sent from the content client to the server.
/// @param event The event containing the message data.
self.onmessage  = function (event)
{
    var      ID = BitstormContentServerCommand;
    var     msg = event.data;
    switch (msg.id)
    {
        case ID.ADD_SERVER:
            {
                //
            }
            break;

        case ID.REMOVE_SERVER:
            {
                //
            }
            break;

        default:
            {
                //
            }
            break;
    };
    console.log('Received client message '+msg);
};
