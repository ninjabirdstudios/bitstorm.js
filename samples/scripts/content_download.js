/*/////////////////////////////////////////////////////////////////////////////
/// @summary JavaScript code associated with the global_events.html sample.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var client = null;
var intId  = 0;
var count  = 0;

function doSomeStuff()
{
    if (10 > count++)
    {
        client.addServer('http://foo.bar/content');
    }
    else
    {
        clearInterval(intId);
        client.serverThread.terminate();
    }
}

/// Let bitstorm.js know where it can find its modules, relative to the parent
/// document. If this is a non-empty string, it should end in '/'.
bitstorm.scriptPath = '../scripts/';
bitstorm.once('domready', function (engine)
    {
        console.log('Received bitstorm.js domready event.');
    });
bitstorm.once('pageready', function (engine)
    {
        console.log('Received bitstorm.js pageload event.');
    });
bitstorm.once('coreready', function (engine)
    {
        console.log('Received bitstorm.js startup event.');
        intId  = setInterval(doSomeStuff, 1000);
        client = new BitstormContentClient();
        client.startServer();
    });
