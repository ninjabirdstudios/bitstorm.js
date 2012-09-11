/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the top-level bitstorm object and any types used globally.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// Constructor function for the BitstormCore type, which provides a few
/// foundation-level functions the rest of the library is built upon.
var BitstormCore = function ()
{
    /* empty */
};

/// Define a utility function to perform prototype inheritence, such that a
/// child type inherits the fields and methods of a parent type.
/// @param childCtor The constructor function for the child type.
/// @param parentCtor The constructor function for the parent type.
BitstormCore.inherits = function (childCtor, parentCtor)
{
    childCtor.supertype = parentCtor;
    childCtor.prototype = Object.create(
        parentCtor.prototype, {
            constructor : {
                value         : childCtor,
                enumerable    : false,
                writable      : true,
                configurable  : true
            }
        });
};

/// Constructor function for the core BitstormEmitter type, which provides a
/// simple node.js-style EventEmitter implementation.
var BitstormEmitter = function ()
{
    /* empty */
};

/// Registers an event listener for a particular named event type.
/// @param event A string specifying the name of the event to listen for.
/// @param callback A function to invoke when the specified event is emitted.
/// @return A reference to the calling context.
BitstormEmitter.prototype.on = function (event, callback)
{
    var  listeners   = this.listeners   || {};
    var  handler     = listeners[event] || []; handler.push(callback);
    this.listeners   = this.listeners   || listeners;
    listeners[event] = handler;
    return this;
};

/// Registers an event listener to be called once for a particular named event.
/// @param event A string specifying the name of the event to listen for.
/// @param callback A function to invoke when the specified event is emitted.
/// @return A reference to the calling context.
BitstormEmitter.prototype.once = function (event, callback)
{
    var self = this;
    var func = function ()
        {
            self.removeListener(event, func);
            callback.apply(this, arguments);
        };
    func.callback = callback;
    return self.on(event, func);
};

/// Registers an event listener for a particular named event type.
/// @param event A string specifying the name of the event to listen for.
/// @param callback A function to invoke when the specified event is emitted.
/// @return A reference to the calling context.
BitstormEmitter.prototype.addListener = BitstormEmitter.prototype.on; // alias

/// Removes a registered event listener for a particular named event type.
/// @param event A string specifying the name of the event.
/// @param callback The callback function registered to listen for @a event and
/// identifying which listener to remove.
/// @return A reference to the calling context.
BitstormEmitter.prototype.removeListener = function (event, callback)
{
    var  listeners   = this.listeners   || {};
    var  handler     = listeners[event] || [];
    this.listeners   = this.listeners   || listeners;
    handler.splice(handler.indexOf(callback), 1);
    listeners[event] = handler;
    return this;
};

/// Removes all registered event listeners for a particular named event type.
/// @param event A string specifying the name of the event.
/// @return A reference to the calling context.
BitstormEmitter.prototype.removeAllListeners = function (event)
{
    var  listeners   = this.listeners || {};
    this.listeners   = this.listeners || listeners;
    listeners[event] = null;
    return this;
};

/// Emits a named event, immediately invoking all registered listeners. Any
/// additional arguments aside from @a event are passed to the listeners.
/// @param event A string specifying the name of the event being raised.
/// @return A reference to the calling context.
BitstormEmitter.prototype.emit = function (event)
{
    var  listeners = this.listeners || {};
    this.listeners = this.listeners || listeners;
    var  listener  = this.listeners[event];
    if  (listener)
    {
        var count  = arguments.length;
        var n      = listener.length;
        var i      = 0;
        switch (count)
        {
            case 1:
                for (i = 0; i < n; ++i)
                    listener[i].call(this);
                break;
            case 2:
                for (i = 0; i < n; ++i)
                    listener[i].call(this, arguments[1]);
                break;
            case 3:
                for (i = 0; i < n; ++i)
                    listener[i].call(this, arguments[1], arguments[2]);
                break;
            default:
                var args = Array.prototype.slice.call(arguments, 1);
                for (i   = 0; i < n; ++i)
                    listener[i].apply(this, args);
                break;
        }
    }
    return this;
};

/// The BitstormCore type inherits functionality from BitstormEmitter, allowing
/// the top-level bitstorm object instance to emit global events.
BitstormCore.inherits(BitstormCore, BitstormEmitter);
