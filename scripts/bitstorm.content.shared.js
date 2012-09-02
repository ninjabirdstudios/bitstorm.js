/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines constants and types used by both the client and server
/// sides of the content management system.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// Defines the command identifiers for commands that can be sent from the
/// BitstormContentServer to BitstormContentClient.
var BitstormContentClientCommand = {
    /// Indicates that an error occurred. The message data is...
    ERROR         : 0,
};

/// Defines the command identifiers for commands that can be sent from the
/// BitstormContentClient to BitstormContentServer.
var BitstormContentServerCommand = {
    /// Adds a server to the list of servers that provide content to the
    /// client. The message object should have a single 'url' field that
    /// specifies the string of the URL to add.
    ADD_SERVER    : 0,
    /// Removes a server from the list of servers that provide content to the
    /// client. The message object should have a single 'url' field that
    /// specifies the string of the URL to remove.
    REMOVE_SERVER : 1
};
