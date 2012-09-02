/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the BitstormContentClient type which manages content
/// downloaded on a background thread.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/

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

/// Handles a message.
BitstormContentClient.prototype.handleServerMessage = function (event)
{
    var  ID = BitstormContentClientCommand;
    var msg = event.data;
    switch (msg.id)
    {
        case ID.ERROR:
            {
                //
            }
            break;

        default:
            {
                //
            }
            break;
    }
    console.log('Received server message '+msg);
};

BitstormContentClient.prototype.startServer = function ()
{
    this.serverThread           = new Worker('../scripts/bitstorm.content.server.js');
    this.serverThread.onmessage = this.handleServerMessage.bind(this);
    return this;
};

BitstormContentClient.prototype.addServer = function (url)
{
    this.serverThread.postMessage({
        id   : BitstormContentServerCommand.ADD_SERVER,
        url  : url
    });
};
