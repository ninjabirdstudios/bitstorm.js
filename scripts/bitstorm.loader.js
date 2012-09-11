/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines the top-level bitstorm object and implements the entry
/// point that loads all bitstorm.js modules. This is the only bitstorm module
/// that should be included directly on a script tag.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// The top-level bitstorm object. All of the engine functionality is available
/// through the properties of this object. For best performance, module
/// properties are cached by sub-modules. The bitstorm instance implements the
/// EventEmitter interface so that global events can be emitted and caught.
var bitstorm   = {
    listeners  : {},
    scriptPath : '',
    document   : document,
    window     : window,
};

/// Registers an event listener for a particular named event type.
/// @param event A string specifying the name of the event to listen for.
/// @param callback A function to invoke when the specified event is emitted.
/// @return A reference to the calling context.
bitstorm.on = function (event, callback)
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
bitstorm.once = function (event, callback)
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
bitstorm.addListener = bitstorm.on; // alias

/// Removes a registered event listener for a particular named event type.
/// @param event A string specifying the name of the event.
/// @param callback The callback function registered to listen for @a event and
/// identifying which listener to remove.
/// @return A reference to the calling context.
bitstorm.removeListener = function (event, callback)
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
bitstorm.removeAllListeners = function (event)
{
    var  listeners   = this.listeners || {};
    this.listeners   = this.listeners || listeners;
    listeners[event] = [];
    return this;
};

/// Emits a named event, immediately invoking all registered listeners. Any
/// additional arguments aside from @a event are passed to the listeners.
/// @param event A string specifying the name of the event being raised.
/// @return A reference to the calling context.
bitstorm.emit = function (event)
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

/// Callback invoked when the DOM has been parsed and is available for
/// manipulation, but possibly before other resources (scripts, images, css...)
/// have finished loading. We kick off asynchronous loading of the rest of the
/// bitstorm.js modules here, and emit a 'coreready' event on the main bitstorm
/// object when they have all loaded successfully.
bitstorm.handleDOMContentLoaded = function ()
{
    var doc = bitstorm.document;
    var fun = bitstorm.handleDOMContentLoaded;
    doc.removeEventListener('DOMContentLoaded', fun);
    bitstorm.emit('domready', bitstorm);
    Modernizr.load([
        {
            // the following files are always loaded and comprise the
            // core functionality of the bitstorm.js library.
            load     : [
                bitstorm.scriptPath+'bitstorm.core.js',
                bitstorm.scriptPath+'bitstorm.content.shared.js',
                bitstorm.scriptPath+'bitstorm.content.server.js',
                bitstorm.scriptPath+'bitstorm.content.client.js',
            ],
            complete : function () {
                // all of the core files listed in the 'load' array have
                // loaded successfully; bitstorm.js core types may be used.
                bitstorm.emit('coreready', bitstorm);
            }
        }
    ]);
}

/// Callback invoked when all page resources (images, css, etc.) have finished
/// loading and are available for use. The bitstorm object will emit an event
/// 'pageready' in this case.
bitstorm.handleWindowLoad = function ()
{
    var win = bitstorm.window;
    var fun = bitstorm.handleWindowLoad;
    win.removeEventListener('load', fun);
    bitstorm.emit('pageready', bitstorm);
}

/// Hook the global DOMContentLoaded event to be notified when the DOM is
/// available for manipulation by the application.
bitstorm.document.addEventListener(
    'DOMContentLoaded',
    bitstorm.handleDOMContentLoaded.bind(bitstorm));

/// Hook the global window onload event to be notified when all page resources
/// have been loaded successfully.
bitstorm.window.addEventListener(
    'load',
    bitstorm.handleWindowLoad.bind(bitstorm));
