/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines constants and types used by both the client and server
/// sides of the content management system.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// Defines the command identifiers for commands that can be sent from the
/// BitstormContentServer to BitstormContentClient.
var BitstormContentClientCommand = {
    /// Indicates that an error occurred. The message data consists of a
    /// single field, 'error', which contains a string with more information.
    ERROR         : 0,
    /// Indicates that a cache is ready for use by the client. The message data
    /// consists of a single field, 'name', which specifies the string name of
    /// the cache.
    CACHE_READY   : 1,
    /// Reports completion progress on a resource download operation. The
    /// message data consists of a 'requestId' specifying the client identifier
    /// for the request (as specified on the GET_RESOURCE command), and a
    /// 'progress' value specifying a percentage of completion in [0, 100].
    PROGRESS      : 2,
    /// Reports that the data for a resource has been successfully retrieved.
    /// The message data consists of a 'requestId' specifying the client
    /// identifier for the request (as specified on the GET_RESOURCE command),
    /// a 'resourceUrl' specifying the URL from which the resource was loaded,
    /// a 'resourceName' specifying the relative path and filename of the
    /// resource, a 'resourceData' specifying the resource data object and a
    /// 'resourceType' specifying the response type.
    RESOURCE_DATA : 3
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
    REMOVE_SERVER : 1,
    /// Opens a named data cache that can be used to cache data on the client.
    /// The message object should have a single 'name' field that specifies the
    /// string name of the cache.
    OPEN_CACHE    : 2,
    /// Deletes all data cached under a given identifier. The message object
    /// should have a single 'name' field that specifies the string name of the
    /// cache. If the cache is currently open, it is closed and then deleted.
    DELETE_CACHE  : 3,
    /// Requests a resource. The message object should have the fields:
    /// msg.requestId: An application-defined identifier for the request.
    /// msg.cacheName: A string specifying the name of the opened, ready cache.
    /// This value is required and cannot be empty.
    /// msg.preferredServer: A string specifying the preferred server. If not
    /// present, the server with the lowest estimated load value is selected.
    /// msg.resourceName: A string specifying the relative path and filename of
    /// the resource to request. This value is required and cannot be empty.
    /// msg.responseType: A string specifying the desired interpretation of the
    /// data returned by the server. May be one of 'blob', 'json', 'text',
    /// 'document' or 'arraybuffer'. The default is 'arraybuffer'.
    /// msg.returnCached: A boolean value. If true, and the resource exists in
    /// the cache, the cached copy is returned. If false, the resource is
    /// always downloaded from the network.
    GET_RESOURCE  : 4
};
