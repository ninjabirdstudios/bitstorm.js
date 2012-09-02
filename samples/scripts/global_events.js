/*/////////////////////////////////////////////////////////////////////////////
/// @summary JavaScript code associated with the global_events.html sample.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// Let bitstorm.js know where it can find its modules, relative to the parent
/// document. If this is a non-empty string, it should end in '/'.
bitstorm.scriptPath = '../scripts/';
bitstorm.once('domready', function (engine)
    {
        console.log('Received bitstorm.js domready event.');
    });
bitstorm.once('pageready', function (engine)
    {
        console.log('Received bitstorm.js pageready event.');
    });
bitstorm.once('coreready', function (engine)
    {
        console.log('Received bitstorm.js coreready event.');
    });
