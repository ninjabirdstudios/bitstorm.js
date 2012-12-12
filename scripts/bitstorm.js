/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a small runtime library to manage the download, caching
/// and extraction of content files packaged into tar archives.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var Bitstorm = (function (exports)
{
    /// Default values exported by the module for expected tick duration,
    /// minimum tick duration and maximum tick duration. All values are
    /// expressed in seconds.
    const clock = {
        /// The default duration of a single clock tick, specified in seconds. The
        /// default value is 1/60th of a second, or 60 ticks-per-second.
        DEFAULT_TICK_DURATION : 1.0 /   60.0,
        /// The maximum reportable tick duration. If a clock tick duration exceeds
        /// this value, the duration is clamped to this value.
        MAXIMUM_TICK_DURATION : 1.0 /    2.0,
        /// The minimum reportable tick duration. If a clock tick duration is less
        /// than this value, this value is reported.
        MINIMUM_TICK_DURATION : 1.0 / 1000.0,
    };

    /// Constructs a new clock state object initialized with the specified
    /// properties.
    /// @param expDuration The expected duration of a single clock tick,
    /// specified in seconds.
    /// @param minDuration The minimum reportable tick duration, in seconds.
    /// @param maxDuration The maximum reportable tick duration, in seconds.
    /// @param now The current time value, in milliseconds. Typically, the
    /// value returned by Date.now() is passed.
    /// @return A new object representing the clock state.
    function createClock(expDuration, minDuration, maxDuration, now)
    {
        var tmpDuration         = 0.0;
        if (isNaN(now)) now     = 0.0;
        if (isNaN(expDuration)) expDuration = clock.DEFAULT_TICK_DURATION;
        if (isNaN(minDuration)) minDuration = clock.MINIMUM_TICK_DURATION;
        if (isNaN(maxDuration)) maxDuration = clock.MAXIMUM_TICK_DURATION;
        if (minDuration <= 0.0) minDuration = clock.MINIMUM_TICK_DURATION;
        if (maxDuration <= 0.0) maxDuration = clock.MINIMUM_TICK_DURATION;
        if (minDuration >  maxDuration)
        {
            tmpDuration =  minDuration;
            minDuration =  maxDuration;
            maxDuration =  tmpDuration;
        }
        if (expDuration <  minDuration) expDuration = minDuration;
        return {
            startTimeValue      : now,
            lastTimeValue       : now,
            tickCount           : 0,
            tickDuration        : expDuration,
            clientTime          : 0.0,
            serverTime          : 0.0,
            serverTimeOffset    : 0.0,
            defaultTickDuration : expDuration,
            maximumTickLength   : maxDuration,
            minimumTickLength   : minDuration,
            maximumTickDuration : minDuration, // @note: intentional
            minimumTickDuration : maxDuration  // @note: intentional
        };
    }

    /// Updates a clock state with a new time sample value.
    /// @param state The clock state object to update.
    /// @param sampleTime The time sample value used to update the clock,
    /// specified in milliseconds.
    /// @return The input object @a state.
    function updateClock(state, sampleTime)
    {
        var tickDelta =(sampleTime - state.lastTimeValue) * 0.001; // ms => sec
        var duration  = tickDelta;
        if (tickDelta > state.maximumTickLength)
        {
            // enforce a maximum tick duration; useful when performing physical
            // simulations to prevent the time step from getting too large.
            duration  = state.maximumTickLength;
        }
        if (tickDelta < state.minimumTickLength)
        {
            // enforce a minimum tick duration; useful when trying to avoid
            // divide-by-zero errors.
            duration  = state.minimumTickLength;
        }

        // update the clock state members.
        state.lastTimeValue  = sampleTime;
        state.tickDuration   = duration;  // report possibly clamped duration
        state.clientTime    += tickDelta; // keep absolute time correct
        state.serverTime     = state.clientTime + state.serverTimeOffset;
        state.tickCount     += 1;

        // update the minimum and maximum observed tick duration. only update
        // these values after one second of sample data has been gathered and
        // timing values start to settle down.
        if (state.clientTime > 1.0)
        {
            if (tickDelta < state.minimumTickDuration)
            {
                // a new minimum tick duration has been observed.
                state.minimumTickDuration = tickDelta;
            }
            if (tickDelta > state.maximumTickDuration)
            {
                // a new maximum tick duration has been observed.
                state.maximumTickDuration = tickDelta;
            }
        }
        return state;
    }

    /// Resumes a clock instance after a pause period, adjusting its values to
    /// prevent a sudden jump in the time delta.
    /// @param state The clock state to update.
    /// @param resumeTime The current clock sample time value, specified in
    /// milliseconds.
    /// @return The input object @a state.
    function resumeClock(state, resumeTime)
    {
        state.lastTimeValue = resumeTime;
        state.tickDuration  = state.defaultTickDuration;
        state.clientTime   += state.defaultTickDuration;
        state.serverTime    = state.clientTime + state.serverTimeOffset;
        state.tickCount    += 1;
        // @note: don't update min/max tick durations.
        return state;
    }

    /// Computes the current, minimum and maximum number of ticks-per-second
    /// for a given clock instance.
    /// @param state The clock state object to query.
    /// @param result The object used to store the updated clock statistics.
    /// This object is updated with currentTPS, minimumTPS and maximumTPS
    /// properties. If this reference is null or undefined, a new object is
    /// created and returned.
    /// @return An object with currentTPS, minimumTPS and maximumTPS
    /// properties. If specified, the @a result object is returned; otherwise,
    /// a new object is returned.
    function clockStatistics(state, result)
    {
        if (!result)
        {
            result = {
                currentTPS    : 1.0 / state.tickDuration,
                minimumTPS    : 1.0 / state.maximumTickDuration,
                maximumTPS    : 1.0 / state.minimumTickDuration
            };
        }
        else
        {
            result.currentTPS = 1.0 / state.tickDuration;
            result.minimumTPS = 1.0 / state.maximumTickDuration;
            result.maximumTPS = 1.0 / state.minimumTickDuration;
        }
        return result;
    }

    /// Implements a generic object constructor function that either returns
    /// the arguments passed to the objectListAllocate() function, or, if
    /// @a args is null or undefined, a new, empty object instance.
    /// @param args Arguments passed to the objectListAllocate() function.
    /// @return An object instance as described above.
    function defaultConstructor(args)
    {
        // return either the input arguments or a new, empty object.
        return (args != null && args != undefined) ? args : {};
    }

    /// Implements a generic object destructor function that is a no-op.
    /// @param ref The object instance being destroyed.
    function defaultDestructor(ref)
    {
        /* empty */
    }

    /// Converts an object ID into an array index for a given object list.
    /// @param list The object list.
    /// @param id The object identifier.
    /// @return The zero-based index into the object list object array for
    /// the object associated with @a id.
    function objectIdToIndex(list, id)
    {
        return (id & list.INDEX_MASK);
    }

    /// Creates and initializes a new object list instance. The object list
    /// can provide handles for up to @a max_objects - 1 active objects.
    /// @param maxObjects The maximum number of objects of the type managed
    /// by the object list. This value must be a power of two less than or
    /// equal to 65536 (0xFFFF).
    /// @param ctorFunc A function representing the object constructor that
    /// is used to create a new instance of the managed object. This function
    /// is called when a new object is allocated. It has a signature
    /// function (args) : object
    /// where the args parameter is the arguments object passed to the object
    /// list allocation function. If the constructor is null or undefined, a
    /// generic constructor is used which returns the arguments if they are
    /// specified, or an empty object.
    /// @param dtorFunc A function representing the object destructor that
    /// is used when an instance of the managed object type is being destroyed.
    /// This function could be used to add the object instance back to a free
    /// list, for example. It has a function signature: function (ref) : void
    /// where the ref parameter is the object instance being destroyed. If the
    /// destructor is null or undefined, a generic no-op destructor is used.
    /// @return The new object list instance, or null.
    function createObjectList(maxObjects, ctorFunc, dtorFunc)
    {
        if (maxObjects > 0xFFFF || (maxObjects & (maxObjects - 1)) != 0)
        {
            // maxObjects must be a power-of-two <= 0xFFFF.
            return null;
        }

        // make sure that a constructor and destructor have been specified.
        ctorFunc = ctorFunc || defaultConstructor;
        dtorFunc = dtorFunc || defaultDestructor;

        // create the new object list instance.
        var list = {
            MAX_OBJECTS : maxObjects,
            NEW_ID_ADD  : maxObjects,
            INDEX_MASK  : maxObjects - 1,
            construct   : ctorFunc,
            destroy     : dtorFunc,
            count       : 0,
            fifoTail    : 0,
            fifoHead    : maxObjects - 1,
            indices     : new Array(maxObjects),
            objects     : new Array(maxObjects)
        };

        // initialize each element of the indices field.
        for (var i = 0; i < maxObjects; ++i)
        {
            list.indices[i] = {
                id    : i,
                index : 0xFFFF,
                next  : i + 1
            };
        }
        return list;
    }

    /// Nulls all references stored in an object list so that objects can be
    /// properly garbage collected. The destructor supplied to the function
    /// createObjectList() is invoked on each object.
    /// @param list The object list to destroy.
    function deleteObjectList(list)
    {
        for (var i   = 0; i < list.MAX_OBJECTS; ++i)
        {
            var obj  = list.objects[i];
            list.indices[i] = null;
            list.objects[i] = null;
            if (obj != null)  list.destroy(obj);
        }
        list.MAX_OBJECTS = 0;
        list.NEW_ID_ADD  = 0;
        list.INDEX_MASK  = 0;
        list.construct   = null;
        list.destroy     = null;
        list.count       = 0;
        list.fifoHead    = 0;
        list.fifoTail    = 0;
        list.indices     = null;
        list.objects     = null;
    }

    /// Determines whether a given object ID is valid within an object list.
    /// @param list The object list instance.
    /// @param id The object ID to check.
    /// @return true if the specified ID represents a valid object.
    function objectListHas(list, id)
    {
        var ind = list.indices[id & list.INDEX_MASK];
        return (ind.id == id && ind.index != 0xFFFF);
    }

    /// Retrieves the object instance associated with a given object ID. The
    /// validity of the object ID is not checked, so if you aren't sure, use
    /// the objectListHas() function first.
    /// @param list The object list instance.
    /// @param id The object ID specifying the object to retrieve.
    /// @return The object instance associated with @a id.
    function objectListGet(list, id)
    {
        var ind = list.indices[id & list.INDEX_MASK];
        return list.objects[ind.index];
    }

    /// Allocates and initializes a new object instance from an object list.
    /// @param list The object list instance.
    /// @param args Optional arguments to pass to the object constructor
    /// function.
    /// @return A reference to the new object. The object instance has a field,
    /// id, which stores the object identifier within the object list. If no
    /// more objects are available in the object list, the function returns
    /// the value null.
    function objectListAllocate(list, args)
    {
        if (list.count < list.MAX_OBJECTS - 1)
        {
            var ind                  = list.indices[list.fifoTail];
            list.fifoTail            = ind.next;
            ind.id                  += list.NEW_ID_ADD;
            ind.index                = list.count++;
            var obj                  = list.construct(args);
            obj.id                   = ind.id;
            list.objects[ind.index]  = obj;
            return obj;
        }
        else return null;
    }

    /// Deletes an active item from an object list.
    /// @param list The object list instance.
    /// @param id The object identifier of the item to delete.
    function objectListDelete(list, id)
    {
        var mask                         = list.INDEX_MASK;
        var idi                          = id & mask;
        var end                          = list.count - 1;
        // ind is the index object of the item being deleted.
        var ind                          = list.indices[idi];
        // ref is a reference to the item being deleted.
        var ref                          = list.objects[ind.index];
        // obj is the last active item in the object array. we swap
        // this item into the position occupied by ref, the removed item.
        var obj                          = list.objects[end];
        list.objects[end]                = null;
        list.objects[ind.index]          = obj;
        // now we need to update the index object of obj since we moved it.
        var idl                          = obj.id & mask;
        list.indices[idl].index          = ind.index;
        ind.index                        = 0xFFFF;
        // return id to the free list and decrement the active object count.
        list.indices[list.fifoHead].next = idi;
        list.fifoHead                    = idi;
        list.count                       = end;
        // finally, call the destructor function on the deleted object.
        list.destroy(ref);
    }

    /// Provides a default state enter function that evaluates to a no-op. This
    /// function can be used by state implementations that do not need to
    /// perform any custom operations when the state is entered.
    /// @param stateMachine The state machine object data.
    /// @param state The object data associated with the state being entered.
    /// @param oldId The identifier of the state being exited.
    /// @param newId The identifier of the state being entered.
    function defaultStateEnter(stateMachine, state, oldId, newId)
    {
        /* empty */
    }

    /// Provides a default state exit function that evaluates to a no-op. This
    /// function can be used by state implementations that do not need to
    /// perform any custom operations when the state is exited.
    /// @param stateMachine The state machine object data.
    /// @param state The object data associated with the state being exited.
    /// @param oldId The identifier of the state being exited.
    /// @param newId The identifier of the state being entered.
    function defaultStateLeave(stateMachine, state, oldId, newId)
    {
        /* empty */
    }

    /// Provides a default state update function that evaluates to a no-op.
    /// This function can be used by state implementations that do not need to
    /// perform any operations on a per-tick basis.
    /// @param stateMachine The state machine object data.
    /// @param state The object data associated with the current state.
    /// @param elapsedTime The elapsed time since the last tick, in seconds.
    /// @param currentTime The current absolute time value, in seconds.
    function defaultStateUpdate(stateMachine, state, elapsedTime, currentTime)
    {
        /* empty */
    }

    /// Provides a default event processing function that evaluates to a no-op
    /// and does not change the current state. This function can be used by
    /// state implementations that are never exited.
    /// @param stateMachine The state machine object data.
    /// @param state The object data associated with the current state.
    /// @param ev The event data being passed to the state.
    /// @return The identifier of the new state.
    function defaultStateProcessEvent(stateMachine, state, ev)
    {
        return state.id;
    }

    /// Creates a new state machine object.
    /// @param stateCount The number of states to be defined.
    /// @param defaultStateId The identifier (not the implementation) of the
    /// default state.
    /// @return An object representing the current state data associated with a
    /// state machine implementation.
    function createStateMachine(stateCount, defaultStateId)
    {
        return {
            currentState : null,
            defaultState : defaultStateId,
            eventCount   : 0,
            eventQueue   : new Array(16),
            states       : new Array(stateCount)
        };
    }

    /// Creates a new state implementation and registers it with a state
    /// machine instance. Set the enter, leave, update and processEvent fields
    /// to user-defined functions as desired.
    /// @param stateMachine The state machine object data.
    /// @param stateId The identifier of the state implementation to create.
    /// @return An object representing the new state implementation.
    function createState(stateMachine, stateId)
    {
        var state = {
            id            : stateId,
            stateMachine  : stateMachine,
            enter         : defaultStateEnter,
            leave         : defaultStateLeave,
            update        : defaultStateUpdate,
            processEvent  : defaultStateProcessEvent
        };
        // register the state within the state machine:
        stateMachine.states[stateId] = state;
        return state;
    }

    /// Posts an event (input) to a state machine. Events can trigger state
    /// changes and are passed to the current state during the state machine
    /// update tick.
    /// @param stateMachine The state machine instance.
    /// @param ev An object representing the event to post.
    function stateMachinePostEvent(stateMachine, ev)
    {
        stateMachine.eventQueue[stateMachine.eventCount++] = ev;
    }

    /// Clears the event queue associated with a state machine instance.
    /// @param stateMachine The state machine instance.
    function stateMachineFlushQueue(stateMachine)
    {
        for (var i = 0; i < stateMachine.eventQueue.length; ++i)
        {
            // null the data so it can be garbage collected.
            stateMachine.eventQueue[i] = null;
        }
        stateMachine.eventCount = 0;
    }

    /// Implements the update loop for a generic finite state machine.
    /// @param stateMachine The state machine instance to update.
    /// @param elapsedTime The elapsed time since the last tick, in seconds.
    /// @param currentTime The current absolute time value, in seconds.
    function stateMachineUpdate(stateMachine, elapsedTime, currentTime)
    {
        var states      = stateMachine.states;
        var eventIndex  = 0;
        var keepRunning = true;

        // enter the default state if necessary.
        if (stateMachine.currentState === null)
        {
            var def = states[stateMachine.defaultState];
            stateMachine.currentState   = def.id;
            def.enter(stateMachine,  def, def.id, def.id);
        }

        // enter the state machine update loop.
        while (keepRunning)
        {
            var stateId0   = stateMachine.currentState;
            var stateId1   = stateMachine.currentState;
            var state0     = states[stateId0];
            var state1     = states[stateId1];

            // by default, only run for one update cycle.
            keepRunning    = false;

            // dispatch events until the state has changed or
            // there are no more events in the event queue.
            while (stateId0 === stateId1 && stateMachine.eventCount > 0)
            {
                // pop an item from the event queue.
                var ev = stateMachine.eventQueue[eventIndex];
                stateMachine.eventQueue[eventIndex++] = null;

                // pass the event to the current state implementation.
                // the state's processEvent function returns a new ID.
                stateId1 = state0.processEvent(stateMachine, state0, ev);
                if (stateId0 !== stateId1)
                {
                    // the event triggered a state change.
                    state1 = states[stateId1];
                    state0.leave(stateMachine, state0, stateId0, stateId1);
                    state1.enter(stateMachine, state1, stateId0, stateId1);
                    keepRunning = true;
                }

                // run a single update tick for the current state.
                state1.update(stateMachine, state1, elapsedTime, currentTime);

                // swap state pointers for the next loop iteration.
                stateMachine.currentState = stateId1;
                stateId0                  = stateId1;
                state0                    = state1;
            }
        }

        // flush all events in the event queue.
        stateMachine.eventCount = 0;
    }

    /// Constructor function for the core Emitter type, which provides a
    /// simple node.js-style EventEmitter implementation.
    var Emitter = function ()
    {
        /* empty */
    };

    /// Registers an event listener for a particular named event type.
    /// @param event A string specifying the name of the event to listen for.
    /// @param callback A function to invoke when the event is emitted.
    /// @return A reference to the calling context.
    Emitter.prototype.on = function (event, callback)
    {
        var  listeners   = this.listeners   || {};
        var  handler     = listeners[event] || []; handler.push(callback);
        this.listeners   = this.listeners   || listeners;
        listeners[event] = handler;
        return this;
    };

    /// Registers an event listener to be called once for a named event.
    /// @param event A string specifying the name of the event to listen for.
    /// @param callback A function to invoke when the event is emitted.
    /// @return A reference to the calling context.
    Emitter.prototype.once = function (event, callback)
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
    /// @param callback A function to invoke when the event is emitted.
    /// @return A reference to the calling context.
    Emitter.prototype.addListener = BitstormEmitter.prototype.on; // alias

    /// Removes a registered event listener for a particular named event type.
    /// @param event A string specifying the name of the event.
    /// @param callback The callback function registered to listen for @a event
    /// and identifying which listener to remove.
    /// @return A reference to the calling context.
    Emitter.prototype.removeListener = function (event, callback)
    {
        var  listeners   = this.listeners   || {};
        var  handler     = listeners[event] || [];
        this.listeners   = this.listeners   || listeners;
        handler.splice(handler.indexOf(callback), 1);
        listeners[event] = handler;
        return this;
    };

    /// Removes all registered event listeners for a particular event type.
    /// @param event A string specifying the name of the event.
    /// @return A reference to the calling context.
    Emitter.prototype.removeAllListeners = function (event)
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
    Emitter.prototype.emit = function (event)
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

    /// Adds the methods of the Emitter object to a specific instance of an
    /// existing object. This is different from the inherits() function, which
    /// adds the Emitter methods to the object prototype.
    /// @param target The target object instance.
    /// @return A reference to @a target.
    function make_emitter(target)
    {
        target                    = target || {};
        target.on                 = Emitter.prototype.on;
        target.once               = Emitter.prototype.once;
        target.emit               = Emitter.prototype.emit;
        target.addListener        = Emitter.prototype.addListener;
        target.removeListener     = Emitter.prototype.removeListener;
        target.removeAllListeners = Emitter.prototype.removeAllListeners;
        return target;
    }

    /// Define a utility function to perform prototype inheritence, such that a
    /// child type inherits the fields and methods of a parent type.
    /// @param childCtor The constructor function for the child type.
    /// @param parentCtor The constructor function for the parent type.
    function inherits(childCtor, parentCtor)
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
    }

    /// set the functions and types exported from the module.
    make_emitter(exports);
    exports.inherits               = inherits;
    exports.makeEmitter            = make_emitter;
    exports.createClock            = createClock;
    exports.updateClock            = updateClock;
    exports.resumeClock            = resumeClock;
    exports.clockStatistics        = clockStatistics;
    exports.createObjectList       = createObjectList;
    exports.deleteObjectList       = deleteObjectList;
    exports.objectListHas          = objectListHas;
    exports.objectListGet          = objectListGet;
    exports.objectListAllocate     = objectListAllocate;
    exports.objectListDelete       = objectListDelete;
    exports.createState            = createState;
    exports.createStateMachine     = createStateMachine;
    exports.stateMachinePostEvent  = stateMachinePostEvent;
    exports.stateMachineFlushQueue = stateMachineFlushQueue;
    exports.stateMachineUpdate     = stateMachineUpdate;
    exports.Emitter                = Emitter;
    return exports;
}(Bitstorm || {}));

/// Make the document and window references available at the global scope.
/// Expose a global scriptPath property so bitstorm.js knows its location.
Bitstorm.window     = window;
Bitstorm.document   = document;
Bitstorm.scriptPath = '';

/// Callback invoked when the global window object raises the 'load' event
/// to indicate that all page content (scripts, images, CSS, etc.) have been
/// loaded and are available for use.
function bitstorm_WinOnLoad()
{
    window.removeEventListener('load', bitstorm_WinOnLoad);
    Bitstorm.emit('window:ready', Bitstorm);
}

/// Callback invoked when the global document object raises the
/// 'DOMContentLoaded' event to indicate that DOM has been parsed and can be
/// accessed and manipulated by JavaScript code.
function bitstorm_DocOnLoad()
{
    document.removeEventListener('DOMContentLoaded', bitstorm_DocOnLoad);
    Bitstorm.emit('dom:ready', Bitstorm);
}
window.addEventListener('load', bitstorm_WinOnLoad);
document.addEventListener('DOMContentLoaded', bitstorm_DocOnLoad);
