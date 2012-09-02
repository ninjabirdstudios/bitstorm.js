/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements the entry point for the Web Worker used to load and
/// cache content in the background.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
importScripts(
    'bitstorm.core.js',
    'bitstorm.content.shared.js',
    'bitstorm.content.server.js'
);

var server = new BitstormContentServer();
