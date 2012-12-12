/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements the entry point of a real-time JavaScript application.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
/// An object storing the global application state.
var State                     = {
    /// The handle returned by window.requestAnimationFrame.
    updateHandle              : 0,
    /// The computed desired presentation time step, in seconds.
    frameTimeStep             : 0.0,
    /// The computed desired simulation time step, in seconds.
    logicTimeStep             : 0.0,
    /// The amount of simulation time for the current frame, in seconds.
    simulationTime            : 0.0,
    /// The amount of simulation time left over from the last frame, in seconds.
    timeAccumulator           : 0.0,
    /// The number of simulation ticks on the current frame.
    simulationCount           : 0,
    /// The DOM element monitored by window.requestAnimationFrame.
    domElement                : null,
    /// The global application real-time clock state.
    clock                     : null
};

/// Constants representing limit values. We enforce limits on the minimum
/// and maximum rates of simulation and presentation ticks. Generally, the
/// monitor refresh rate (and the browser's window.requestAnimationFrame
/// method) are limited to 60Hz, so we choose this as our minimum and
/// maximum presentation rate; however, the browser may select any suitable
/// presentation interval. Timing-wise we are limited to a resolution of
/// one millisecond, so our simulation rate minimum and maximum are set
/// accordingly. Override the application presentation, simulation and frame
/// request rate here.
var constants                 = {
    /// The maximum reportable tick duration. If a clock tick duration exceeds
    /// this value, the duration is clamped to this value.
    MAXIMUM_TICK_DURATION     : 1.0 /    2.0,
    /// The minimum reportable tick duration. If a clock tick duration is less
    /// than this value, this value is reported.
    MINIMUM_TICK_DURATION     : 1.0 / 1000.0,
    /// The minimum number of simulation ticks per-second.
    MINIMUM_SIMULATION_RATE   : 1.0,
    /// The maximum number of simulation ticks per-second.
    MAXIMUM_SIMULATION_RATE   : 1000.0,
    /// The minimum number of presentation ticks per-second.
    MINIMUM_PRESENTATION_RATE : 60.0,
    /// The maximum number of presentation ticks per-second.
    MAXIMUM_PRESENTATION_RATE : 60.0,
    /// The number of presentation ticks per-second.
    PRESENTATION_RATE         : 60.0,
    /// The number of simulation ticks per-second.
    SIMULATION_RATE           : 60.0,
    /// The frame request rate of 60 frames per-second.
    FRAME_REQUEST_RATE        : 1000.0 / 60.0
};

/// Implements a fallback function based on window.setTimeout() for use
/// in cases where window.requestAnimationFrame() is not available.
/// @param callback A function (time:DOMTimeStamp) : void. The time
/// parameter is not supplied by all browsers.
/// @param element The DOM element being updated. This parameter is unused.
/// @return A handle value that can be used to cancel the timeout before
/// it fires.
function setTimeoutFallback(callback, element)
{
    return window.setTimeout(callback, constants.FRAME_REQUEST_RATE);
}

/// Store a reference to the supported implementation of the new API
/// http://www.w3.org/TR/animation-timing/#requestAnimationFrame
/// Prototype: handle request_animation_frame(callback, element)
/// The callback takes a single parameter, the current timestamp.
var requestFrame = (function ()
    {
        return window.requestAnimationFrame       ||
               window.webkitRequestAnimationFrame ||
               window.mozRequestAnimationFrame    ||
               window.oRequestAnimationFrame      ||
               window.msRequestAnimationFrame     ||
               setTimeoutFallback;
    })();

/// Store a reference to the supported implementation of the new API
/// http://www.w3.org/TR/animation-timing/#cancelRequestAnimationFrame
/// Prototype: void cancelAnimationFrame(handle)
var cancelFrame  = (function ()
    {
        return window.cancelRequestAnimationFrame       ||
               window.webkitCancelRequestAnimationFrame ||
               window.mozCancelRequestAnimationFrame    ||
               window.oRequestAnimationFrame            ||
               window.msCancelRequestAnimationFrame     ||
               window.clearTimeout;
    })();

/// Callback invoked when Bitstorm.js emits the 'dom:ready' event. The global
/// State object is initialized here.
/// @param bitstorm A reference to the global Bitstorm.js state.
function init(bitstorm)
{
    var mind               = constants.MINIMUM_TICK_DURATION;
    var maxd               = constants.MAXIMUM_TICK_DURATION;
    var expd               = 1.0 / constants.PRESENTATION_RATE;
    var dom                = document.getElementById('canvas');
    var now                = Date.now();
    State.clock            = bitstorm.createClock(expd, mind, maxd, now);
    State.frameTimeStep    = 1.0 / constants.PRESENTATION_RATE;
    State.logicTimeStep    = 1.0 / constants.SIMULATION_RATE;
    State.simulationTime   = 0.0;
    State.timeAccumulator  = 0.0;
    State.simulationCount  = 0;
    State.domElement       = dom;
}

/// Callback invoked when Bitstorm.js emits the 'window:ready' event. This
/// starts the real-time update loop.
/// @param bitstorm A reference to the global Bitstorm.js state.
function start(bitstorm)
{
    // request notification when it's time to generate the next frame.
    // this starts the real-time update loop. we continue until the
    // caller-supplied tick callback returns false.
    State.updateHandle = requestFrame(frameCallback, State.domElement);
}

/// The default runtime driver module tick callback function. The driver
/// tick callback is invoked every time an animation frame is requested.
/// @param elapsedTime The elapsed time since the last tick, in seconds.
/// @param currentTime The current absolute time value, in seconds.
/// @return true to execute the simulation and presentation portions of the
/// tick, or false to cancel the tick.
function tick(elapsedTime, currentTime)
{
    return true;
}

/// The default runtime driver module presentation callback function. The
/// presentation callback is invoked exactly once per requested animation
/// frame, as long as simulation data is available.
/// @param elapsedTime The elapsed time since the last tick, in seconds.
/// @param currentTime The current absolute time value, in seconds.
/// @param tickTime A normalized time value in [0, 1] representing how far
/// into the current tick the driver is at the time of the call.
function present(elapsedTime, currentTime, tickTime)
{
    /* empty */
}

/// The default runtime river module simulation callback function. The
/// simulation callback may be invoked one or more times per-frame.
/// @param elapsedTime The elapsed time since the last tick, in seconds.
/// @param currentTime The current absolute time value, in seconds.
function simulate(elapsedTime, currentTime)
{
    /* empty */
}

/// Internal callback invoked when the system requests the next frame.
/// @param currTime The current timestamp value, in milliseconds. This
/// value is not supplied by all browsers.
function frameCallback(currTime)
{
    // some browsers do not specify the current time.
    if (!currTime)
    {
        // Date.now() returns the current time in milliseconds, which is
        // the same as the value that would be passed in as currTime.
        currTime = Date.now();
    }

    // cache all of our global state values into local variables.
    var bitstorm       = Bitstorm;
    var clockState     = State.clock;
    var logicStep      = State.logicTimeStep;
    var frameStep      = State.frameTimeStep;
    var currentTime    = 0.0;
    var elapsedTime    = 0.0;

    // immediately schedule the next update. this lets us stay as close
    // to 60 Hz as possible if we're forced to use the setTimeout fallback.
    State.updateHandle = requestFrame(frameCallback, State.domElement);

    // indicate the start of a new tick on the clock.
    bitstorm.updateClock(clockState,currTime);
    currentTime        = clockState.clientTime;
    elapsedTime        = clockState.tickDuration;

    // always execute the tick callback.
    if (!tick(elapsedTime, currentTime))
    {
        // the tick callback returned false. cancel this frame.
        return cancelFrame(State.updateHandle);
    }

    // execute the logic callback. the callback may execute zero times,
    // one time, or more than one time depending on the update rate. the
    // simulation logic always executes with a fixed time step.
    //
    // start out will all of the time from the current tick
    // plus any left over time from the prior tick(s). step
    // at a fixed rate until we have less than one timestep
    // remaining. at each step, we call the simulate callback.
    State.timeAccumulator        += elapsedTime;
    while (State.timeAccumulator >= logicStep)
    {
        simulate(logicStep, State.simulationTime);
        State.simulationTime     += logicStep;
        State.timeAccumulator    -= logicStep;
        State.simulationCount    += 1;
    }

    // execute the presentation callback. we do this only if
    // the simulation callback is non-null, which means that
    // we should have valid presentation state data.
    if (State.simulationCount > 0)
    {
        // we may have some unused portion of time remaining
        // in the timeAccumulator variable, which means that
        // what gets presented is not quite up-to-date. the
        // solution is to provide an interpolation factor we
        // can use to interpolate between the last steps'
        // simulation state and the current steps' state. This
        // prevents temporal aliasing from occurring. See:
        // http://gafferongames.com/game-physics/fix-your-timestep/
        var t = State.timeAccumulator   / logicStep; // in [0, 1].
        present(elapsedTime, currentTime, t);
    }
}
