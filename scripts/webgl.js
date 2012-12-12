/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a set of routines for working with WebGL resources and
/// managing render state and display command lists.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var WebGL = (function (exports)
{
    /// Defines some constant values used to distinguish between shader types
    /// without relying on having a valid WebGLRenderingContext object. These
    /// types are passed to the errorFunc callback of webglBuildProgram().
    const build_stage   = {
        /// Specifies that the error occurred while compiling a vertex shader, and
        /// the source_code field specifies the vertex shader source code.
        COMPILE_VS      : 0,
        /// Specifies that the error occurred while compiling a fragment shader,
        /// and the source_code field specifies the fragment shader source code.
        COMPILE_FS      : 1,
        /// Specifies that the error occurred during the program linking stage.
        LINK_PROGRAM    : 2,
    };

    /// An array specifying the names of the texture slots that can be passed to
    /// gl.activeTexture(). This table is used during uniform binding.
    const texture_slots = [
        'TEXTURE0',  'TEXTURE1',  'TEXTURE2',  'TEXTURE3',  'TEXTURE4',
        'TEXTURE5',  'TEXTURE6',  'TEXTURE7',  'TEXTURE8',  'TEXTURE9',
        'TEXTURE10', 'TEXTURE11', 'TEXTURE12', 'TEXTURE13', 'TEXTURE14',
        'TEXTURE15', 'TEXTURE16', 'TEXTURE17', 'TEXTURE18', 'TEXTURE19',
        'TEXTURE20', 'TEXTURE21', 'TEXTURE22', 'TEXTURE23', 'TEXTURE24',
        'TEXTURE25', 'TEXTURE26', 'TEXTURE27', 'TEXTURE28', 'TEXTURE29',
        'TEXTURE30', 'TEXTURE31'
    ];

    /// An array specifying all of the valid GLSL ES 1.0 type names. This table is
    /// used during uniform binding.
    const type_names    = {
        BOOL            : 'bool',
        INT             : 'int',
        FLOAT           : 'float',
        VEC2            : 'vec2',
        VEC3            : 'vec3',
        VEC4            : 'vec4',
        BVEC2           : 'bvec2',
        BVEC3           : 'bvec3',
        BVEC4           : 'bvec4',
        IVEC2           : 'ivec2',
        IVEC3           : 'ivec3',
        IVEC4           : 'ivec4',
        MAT2            : 'mat2',
        MAT3            : 'mat3',
        MAT4            : 'mat4',
        SAMPLER_2D      : 'sampler2D',
        SAMPLER_CUBE    : 'samplerCube'
    };

    /// An error message (for use with makeFailHtml()) that directs the user to
    /// a page where they can download a browser with WebGL support.
    var get_browser_options = '' +
        'This page requires a browser that supports WebGL.<br/>' +
        '<a href="http://get.webgl.org">Click here to see browser options.</a>';

    /// An error message (for use with makeFailHtml()) that directs the user to
    /// a WebGL troubleshooting page because for some reason WebGL context
    /// creation has failed even though the browser reports that WebGL is
    /// supported - the user could have bad drivers or something.
    var other_problem       = '' +
        "It doesn't appear your computer can support WebGL.<br/>" +
        '<a href="http://get.webgl.org/troubleshooting/">Click here for more information.</a>';

    /// A handy utility function that prevents having to write the same
    /// obnoxious code everytime. The typical javascript '||' trick works for
    /// strings, arrays and objects, but it doesn't work for booleans or
    /// integer values.
    /// @param value The value to test.
    /// @param theDefault The value to return if @a value is undefined.
    /// @return Either @a value or @a theDefault (if @a value is undefined.)
    function defaultValue(value, theDefault)
    {
        return (value !== undefined) ? value : theDefault;
    }

    /// Generates a block of HTML to display a message indicating some issue
    /// with WebGL support. This function is from the Google webgl-utils.js.
    /// @param message The error message text to display.
    /// @return A block of HTML that can be written to the document to indicate
    /// to the user that there is an issue with WebGL support.
    function makeFailHtml(message)
    {
        return '' +
            '<table style="background-color: #8CE; width: 100%; height: 100%;"><tr>' +
            '<td align="center">' +
            '<div style="display: table-cell; vertical-align: middle;">' +
            '<div style="">' + message + '</div>' +
            '</div>' +
            '</td></tr></table>';
    }

    /// Overwrites the inner HTML of the DOM element @a canvas' parent to
    /// display an appropriate error message to the user and directing them to
    /// troubleshooting information. This function is from the Google
    /// webgl-utils.js.
    /// @param canvas The canvas DOM element.
    /// @param message The error message to display.
    function showError(canvas, message)
    {
        var container = canvas.parentNode;
        if (container)  container.innerHTML = makeFailHtml(message);
    }

    /// Uses regular expression matching on the shader source code for a given
    /// vertex and fragment shader pair to extract the uniform names and types
    /// for a given shader program.
    /// @param ref A WebGL shader program object. See programConstructor().
    /// The uniformNames and uniformTypes fields are populated.
    /// @param vs_source A string specifying the vertex shader source code.
    /// @param fs_source A string specifying the fragment shader source code.
    function reflectUniforms(ref, vs_source, fs_source)
    {
        var uniform_match = /uniform\s+(\w+)\s+(\w+)\s*;/g
        var uniforms_vert = vs_source.match(uniform_match);
        var uniforms_frag = fs_source.match(uniform_match);
        if (uniforms_vert)
        {
            for (var i = 0; i < uniforms_vert.length; ++i)
            {
                var uniform      = uniforms_vert[i].split(uniform_match);
                var uniform_type = uniform[1];
                var uniform_name = uniform[2];
                ref.uniformNames.push(uniform_name);
                ref.uniformTypes[uniform_name] = uniform_type;
            }
        }
        if (uniforms_frag)
        {
            // uniforms from the fragment shader.
            for (var i = 0; i < uniformsFrag.length; ++i)
            {
                var uniform      = uniforms_frag[i].split(uniform_match);
                var uniform_type = uniform[1];
                var uniform_name = uniform[2];
                ref.uniformNames.push(uniform_name);
                ref.uniformTypes[uniform_name] = uniform_type;
            }
        }
    }

    /// Uses regular expression matching on the shader source code for a given
    /// vertex and fragment shader pair to extract the attribute names and types
    /// for a given shader program.
    /// @param ref A WebGL shader program object. See programConstructor().
    /// The attributeNames and attributeTypes fields are populated.
    /// @param vs_source A string specifying the vertex shader source code.
    /// @param fs_source A string specifying the fragment shader source code.
    function reflectAttributes(ref, vs_source, fs_source)
    {
        var attribute_match = /attribute\s+(\w+)\s+(\w+)\s*;/g
        var attributes_vert = vs_source.match(attribute_match);
        if (attributes_vert)
        {
            for (var i = 0; i < attributes_vert.length; ++i)
            {
                var attrib       = attributes_vert[i].split(attribute_match);
                var attrib_type  = attrib[1];
                var attrib_name  = attrib[2];
                ref.attributeNames.push(attrib_name);
                ref.attributeTypes[attrib_name] = attrib_type;
            }
        }
    }

    /// Attempts to create a WebGL rendering context.
    /// @param canvas The target canvas element.
    /// @param display_error Specify true to display some error text and a link
    /// to troubleshooting information if the context cannot be created.
    /// Specify false to suppress error reporting.
    /// @param attributes An optional object specifying context attributes.
    /// See http://www.khronos.org/registry/webgl/specs/latest/#5.2.1
    /// @return A WebGLRenderingContext instance, or null.
    function createContext(canvas, display_error, attributes)
    {
        if (!window.WebGLRenderingContext)
        {
            // the browser doesn't support WebGL at all.
            if (display_error) showError(canvas, get_browser_options);
            return null;
        }

        // attempt to create a WebGL context using any of the supported names.
        var names   = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
        var context = null;
        for (var i  = 0; i < names.length; ++i)
        {
            try
            {
                context = canvas.getContext(names[i], attributes);
            }
            catch (e)
            {
                /* empty */
            }
            if (context) return context;
        }
        if (display_error) showError(canvas, other_problem);
        return null;
    }

    /// Implements an object constructor for a WebGL shader program object. The
    /// returned object is initialized to a default state.
    /// @param args Arguments being passed to the constructor.
    /// @return A new WebGL shader program resource object.
    function programConstructor(args)
    {
        return {
            id                     : 0,    /* object list id        */
            programResource        : null, /* WebGLProgram instance */
            vertexShaderResource   : null, /* WebGLShader instance  */
            fragmentShaderResource : null, /* WebGLShader instance  */
            webglContext           : null, /* WebGLRenderingContext */
            boundTextureCount      : 0,
            uniformNames           : [],
            uniformTypes           : {},
            uniformLocations       : {},
            attributeNames         : [],
            attributeTypes         : {},
            attributeIndices       : [],
        };
    }

    /// Implements an object destructor for a WebGL shader program object. All
    /// reference fields of the object are set to null. Note that WebGL
    /// resources will not be freed if they are still bound to an active WebGL
    /// rendering context.
    /// @param ref The shader program object being destroyed.
    function programDestructor(ref)
    {
        if (ref)
        {
            // release WebGL resources.
            var gl = ref.webglContext;
            gl.detachShader(ref.programResource, ref.fragmentShaderResource);
            gl.detachShader(ref.programResource, ref.vertexShaderResource);
            gl.deleteShader(ref.fragmentShaderResource);
            gl.deleteShader(ref.vertexShaderResource);
            gl.deleteProgram(ref.programResource);

            // release references held by the shader program object.
            ref.programResource        = null;
            ref.vertexShaderResource   = null;
            ref.fragmentShaderResource = null;
            ref.webglContext           = null;
            ref.uniformNames           = null;
            ref.uniformTypes           = null;
            ref.uniformLocations       = null;
            ref.attributeNames         = null;
            ref.attributeTypes         = null;
            ref.attributeIndices       = null;
            ref.boundTextureCount      = 0;
        }
    }

    /// Compiles, links and reflects a WebGL shader program, and populates the
    /// fields defined on a WebGL program object @a ref. This function may only
    /// be called from the main thread with full access to the DOM.
    /// @param ref A WebGL program object instance. See programConstructor().
    /// @param gl The WebGLRenderingContext instance used to create resources.
    /// @param vertex_source The vertex shader source code.
    /// @param fragment_source The fragment shader source code.
    /// @param error_func An optional function with signature:
    /// function error_func(ref, stage, source_code, info_log_data) : void
    /// @return true if the shader program was compiled and linked successfully.
    function buildProgram(ref, gl, vertex_source, fragment_source, error_func)
    {
        var vs = gl.createShader(gl.VERTEX_SHADER);
        var fs = gl.createShader(gl.FRAGMENT_SHADER);

        // attempt to compile the vertex shader:
        gl.shaderSource (vs, vertex_source);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) && !gl.isContextLost())
        {
            // an error occurred while compiling the vertex shader. report it.
            var info_log = gl.getShaderInfoLog(vs);
            var stage    = build_stage.COMPILE_VS;
            if (error_func) error_func(ref, stage, vertex_source, info_log);
            gl.deleteShader(fs);
            gl.deleteShader(vs);
            return false;
        }

        // attempt to compile the fragment shader:
        gl.shaderSource (fs, fragment_source);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS) && !gl.isContextLost())
        {
            // an error occurred while compiling the fragment shader. report it.
            var info_log = gl.getShaderInfoLog(fs);
            var stage    = build_stage.COMPILE_FS;
            if (error_func) error_func(ref, stage, fragment_source, info_log);
            gl.deleteShader(fs);
            gl.deleteShader(vs);
            return false;
        }

        // reflect the shader uniforms and attributes.
        webgl_reflect_uniforms  (ref, vertex_source, fragment_source);
        webgl_reflect_attributes(ref, vertex_source, fragment_source);

        // create the shader program with vertex and fragment shaders attached.
        var po = gl.createProgram();
        gl.attachShader(po, vs);
        gl.attachShader(po, fs);

        // bind the vertex attribute locations (must be done before linking).
        for (var i = 0; i < ref.attributeNames.length; ++i)
        {
            var an = ref.attributeNames[i];
            ref.attributeIndices[an] =  i;
            gl.bindAttribLocation(po, i, an);
        }

        // link the shader program object.
        gl.linkProgram(po);
        if (!gl.getProgramParameter(po, gl.LINK_STATUS) && !gl.isContextLost())
        {
            var info_log = gl.getProgramInfoLog(po);
            var stage    = build_stage.LINK_PROGRAM;
            if (error_func) error_func(ref, stage, '', info_log);
            gl.detachShader (po, fs);
            gl.detachShader (po, vs);
            gl.deleteProgram(po);
            gl.deleteShader (fs);
            gl.deleteShader (vs);
            return false;
        }

        // retrieve the bind locations of each uniform.
        for (var i = 0; i < ref.uniformNames.length; ++i)
        {
            var un = ref.uniformNames[i];
            ref.uniformLocations[un] = gl.getUniformLocation(po, un);
        }
        ref.webglContext           = gl;
        ref.programResource        = po;
        ref.vertexShaderResource   = vs;
        ref.fragmentShaderResource = fs;
        ref.boundTextureCount      = 0;
        return true;
    }

    /// Sets the value of a uniform variable in a shader program.
    /// @param ref A WebGL program object instance. See programConstructor()..
    /// @param uniform_name The name of the uniform to set.
    /// @param uniform_value The value to set.
    /// @param transpose Specify true to transpose matrix values.
    function bindUniform(ref, uniform_name, uniform_value, transpose)
    {
        var     gl   = ref.webglContext;
        var     glsl = type_names;
        var     flip = transpose ? gl.TRUE : gl.FALSE;
        var     bind = ref.uniformLocations[uniform_name];
        var     type = ref.uniformTypes[uniform_name];
        switch (type)
        {
            case glsl.VEC4:
                gl.uniform4fv(bind, uniform_value);
                break;

            case glsl.MAT4:
                gl.uniformMatrix4fv(bind, flip, uniform_value);
                break;

            case glsl.SAMPLER_2D:
                gl.activeTexture(gl[texture_slots[ref.boundTextureCount]]);
                gl.bindTexture(gl.TEXTURE_2D, uniform_value);
                gl.uniform1i(bind, ref.boundTextureCount);
                ref.boundTextureCount++;
                break;

            case glsl.VEC3:
                gl.uniform3fv(bind, uniform_value);
                break;

            case glsl.VEC2:
                gl.uniform2fv(bind, uniform_value);
                break;

            case glsl.FLOAT:
                gl.uniform1f(bind, uniform_value);
                break;

            case glsl.SAMPLER_CUBE:
                gl.activeTexture(gl[WebGLTextureSlots[ref.boundTextureCount]]);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, uniform_value);
                gl.uniform1i(bind, ref.boundTextureCount);
                ref.boundTextureCount++;
                break;

            case glsl.MAT3:
                gl.uniformMatrix3fv(bind, flip, uniform_value);
                break;

            case glsl.MAT2:
                gl.uniformMatrix2fv(bind, flip, uniform_value);
                break;

            case glsl.INT:
                gl.uniform1i(bind, uniform_value);
                break;

            case glsl.IVEC4:
                gl.uniform4iv(bind, uniform_value);
                break;

            case glsl.IVEC3:
                gl.uniform3iv(bind, uniform_value);
                break;

            case glsl.IVEC2:
                gl.uniform2iv(bind, uniform_value);
                break;

            case glsl.BOOL:
                gl.uniform1i (bind, uniform_value);
                break;

            case glsl.BVEC4:
                gl.uniform4iv(bind, uniform_value);
                break;

            case glsl.BVEC3:
                gl.uniform3iv(bind, uniform_value);
                break;

            case glsl.BVEC2:
                gl.uniform2iv(bind, uniform_value);
                break;
        }
    }

    /// Computes the maximum number of levels in a mipmap chain for an image
    /// of the specified dimensions.
    /// @param width The width of the source image, in pixels.
    /// @param height The height of the source image, in pixels.
    /// @return The number of levels in the mipmap chain.
    function mipLevelCount(width, height)
    {
        size_t level_count = 0;
        size_t major_dim   = 0;

        // select largest of (width, height).
        major_dim = (width > height) ? width : height;

        // compute levels down to 1 in the major dimension:
        while (major_dim > 0)
        {
            major_dim  >>= 1;
            level_count += 1;
        }
        return level_count;
    }

    /// Computes the dimensions of a particular level in a mipmap chain, given
    /// the dimensions of the highest resolution version of the image.
    /// @param width The width of the source image, in pixels.
    /// @param height The height of the source image, in pixels.
    /// @param index The zero-based index of the level in the mipmap chain.
    /// @return An object specifying the dimensions of the specified level.
    /// obj.width The width of the specified mipmap level, in pixels.
    /// obj.height The height of the specified mipmap level, in pixels.
    function mipLevelDimensions(width, height, index)
    {
        int level_width  = width  >> index;
        int level_height = height >> index;
        return {
            width        : (0 === level_width)  ? 1 : level_width,
            height       : (0 === level_height) ? 1 : level_height
        };
    }

    /// Implements an object constructor for a WebGL texture object. The
    /// returned object is initialized to a default state.
    /// @param args Arguments being passed to the constructor.
    /// @return A new WebGL texture resource object.
    function textureConstructor(args)
    {
        return {
            id              : 0,     /* object list id                */
            textureResource : null,  /* WebGLTexture instance         */
            webglContext    : null,  /* WebGLRenderingContext         */
            hasMipmaps      : false, /* texture has a mip-chain?      */
            userType        : '',    /* 'COLOR', etc. user-defined    */
            bindTarget      : 0,     /* gl.TEXTURE_2D, etc.           */
            textureTarget   : 0,     /* gl.TEXTURE_2D, etc.           */
            format          : 0,     /* gl.RGBA, etc.                 */
            dataType        : 0,     /* gl.UNSIGNED_BYTE, etc.        */
            wrapModeS       : 0,     /* gl.CLAMP_TO_EDGE, etc.        */
            wrapModeT       : 0,     /* gl.CLAMP_TO_EDGE, etc.        */
            magnifyFilter   : 0,     /* gl.LINEAR, etc.               */
            minifyFilter    : 0,     /* gl.LINEAR_MIPMAP_LINEAR, etc. */
            levels          : []     /* mipmap level dimensions       */
        };
    }

    /// Implements an object destructor for a WebGL texture object. All
    /// reference fields of the object are set to null. Note that WebGL
    /// resources will not be freed if they are still bound to an active WebGL
    /// rendering context.
    /// @param ref The texture object being destroyed.
    function textureDestructor(ref)
    {
        if (ref)
        {
            // release WebGL resources.
            var gl = ref.webglContext;
            gl.deleteTexture(ref.textureResource);

            // release references held by the texture object.
            ref.textureResource = null;
            ref.webglContext    = null;
            ref.userType        = null;
            ref.levels          = null;
            ref.bindTarget      = 0;
            ref.textureTarget   = 0;
            ref.format          = 0;
            ref.dataType        = 0;
            ref.wrapModeS       = 0;
            ref.wrapModeT       = 0;
            ref.magnifyFilter   = 0;
            ref.minifyFilter    = 0;
        }
    }

    /// Creates a texture resource. The contents of the texture are initialized
    /// to transparent black. Use the uploadTexture() or uploadTextureRegion()
    /// functions to specify image data.
    /// @param ref A WebGL texture object instance. See textureConstructor().
    /// @param gl The WebGLRenderingContext instance used to create resources.
    /// @param args An object specifying texture attributes. All are required.
    /// @param args.type A string value specifying a user-defined texture type
    /// attribute. This typically describes the usage of the texture, for
    /// example, 'COLOR' for a texture containing color data, 'NORMAL' for a
    /// normal map texture, and so on.
    /// @param args.target A value specifying the texture target: TEXTURE_2D,
    /// TEXTURE_CUBE_MAP_POSITIVE_[X,Y,Z] or TEXTURE_CUBE_MAP_NEGATIVE_[X,Y,Z].
    /// @param args.format A value specifying the texture type. May be one of
    /// ALPHA, LUMINANCE, LUMINANCE_ALPHA, RGB or RGBA.
    /// @param args.dataType A value specifying the format of the texture data.
    /// One of UNSIGNED_BYTE, UNSIGNED_SHORT_5_6_5, UNSIGNED_SHORT_4_4_4_4,
    /// UNSIGNED_SHORT_5_5_5_1, HALF_FLOAT_OES or FLOAT.
    /// @param args.wrapS A value specifying the wrapping mode to use in the
    /// horizontal direction. One of REPEAT, CLAMP_TO_EDGE or MIRRORED_REPEAT.
    /// @param args.wrapT A value specifying the wrapping mode to use in the
    /// vertical direction. One of REPEAT, CLAMP_TO_EDGE or MIRRORED_REPEAT.
    /// @param args.magFilter A value specifying the filter to use when the
    /// texture is magnified. One of NEAREST or LINEAR.
    /// @param args.minFilter A value specifying the filter to use when the
    /// texture is minified. One of NEAREST, LINEAR, NEAREST_MIPMAP_NEAREST,
    /// LINEAR_MIPMAP_NEAREST, NEAREST_MIPMAP_LINEAR or LINEAR_MIPMAP_LINEAR.
    /// @param args.hasMipmaps A boolean value specifying whether the texture
    /// has an associated mip-chain.
    /// @param args.levels An array of objects describing each level in the
    /// mipmap chain. Level 0 represents the highest-resolution image. Each
    /// level object has width, height, byteSize and byteOffset fields.
    /// @return true if the texture resource is created successfully.
    function createTexture(ref, gl, args)
    {
        var textureTarget   = gl[args.target];
        var bindTarget      = gl[args.target];
        if (bindTarget    === gl.TEXTURE_CUBE_MAP_POSITIVE_X ||
            bindTarget    === gl.TEXTURE_CUBE_MAP_POSITIVE_Y ||
            bindTarget    === gl.TEXTURE_CUBE_MAP_POSITIVE_Z ||
            bindTarget    === gl.TEXTURE_CUBE_MAP_NEGATIVE_X ||
            bindTarget    === gl.TEXTURE_CUBE_MAP_NEGATIVE_Y ||
            bindTarget    === gl.TEXTURE_CUBE_MAP_NEGATIVE_Z)
            bindTarget      = gl.TEXTURE_CUBE_MAP;

        // create the texture resource and cache various attributes.
        var resource   = gl.createTexture();
        if (resource === null)
        {
            // likely the context is lost.
            return false;
        }
        ref.webglContext    = gl;
        ref.textureResource = gl.createTexture();
        ref.hasMipmaps      = args.hasMipmaps;
        ref.userType        = args.type;
        ref.bindTarget      = bindTarget;
        ref.textureTarget   = textureTarget;
        ref.format          = gl[args.format];
        ref.dataType        = gl[args.dataType];
        ref.wrapModeS       = gl[args.wrapS];
        ref.wrapModeT       = gl[args.wrapT];
        ref.magnifyFilter   = gl[args.magFilter];
        ref.minifyFilter    = gl[args.minFilter];
        ref.levels          = new Array(args.levels.length);
        for (var i = 0,  n  = args.levels.length; i < n; ++i)
        {
            ref.levels[i]   = {
                width       : args.levels[i].width,
                height      : args.levels[i].height,
                byteSize    : args.levels[i].byteSize,
                byteOffset  : args.levels[i].byteOffset
            };
        }

        // bind the texture and set GL attributes.
        gl.bindTexture  (bindTarget, ref.textureResource);
        gl.texParameteri(bindTarget, gl.TEXTURE_WRAP_S,     ref.wrapModeS);
        gl.texParameteri(bindTarget, gl.TEXTURE_WRAP_T,     ref.wrapModeT);
        gl.texParameteri(bindTarget, gl.TEXTURE_MIN_FILTER, ref.minifyFilter);
        gl.texParameteri(bindTarget, gl.TEXTURE_MAG_FILTER, ref.magnifyFilter);
        return true;
    }

    /// Uploads the complete mip-chain for a texture to the GPU.
    /// @param ref A WebGL texture object instance. See textureConstructor().
    /// @param data An ArrayBuffer storing the raw data for each mip-level.
    function uploadTexture(ref, data)
    {
        var gl       = ref.webglContext;
        var type     = ref.dataType;
        var format   = ref.format;
        var target   = ref.textureTarget;
        gl.bindTexture(ref.bindTexture, ref.textureResource);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        for (var i   = 0, n = ref.levels.length; i < n; ++i)
        {
            var ld   = ref.levels[i];
            var lw   = ld.width;
            var lh   = ld.height;
            var ofs  = ld.byteOffset;
            var size = ld.byteSize;
            var view = null;
            switch (type)
            {
                case gl.UNSIGNED_BYTE:
                    view = new Uint8Array(data, ofs, size);
                    break;
                case gl.UNSIGNED_SHORT_5_6_5:
                case gl.UNSIGNED_SHORT_5_5_5_1:
                case gl.UNSIGNED_SHORT_4_4_4_4:
                    view = new Uint16Array(data, ofs, size >> 1);
                    break;

                default: break;
            }
            gl.texImage2D(target, i, format, lw, lh, 0, format, type, view);
        }
    }

    /// Uploads data to a texture object from a DOM Canvas, Image or Video
    /// element. Only level 0 of the target texture is modified.
    /// @param ref A WebGL texture object instance. See textureConstructor().
    /// @param domElement An instance of HTMLImageElement, HTMLCanvasElement
    /// or HTMLVideoElement specifying the source texture data.
    function uploadTextureDOM(ref, domElement)
    {
        var gl       = ref.webglContext;
        var type     = ref.dataType;
        var format   = ref.format;
        gl.bindTexture(ref.bindTexture, ref.textureResource);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(ref.textureTarget, 0, format, format, type, domElement);
    }

    /// Uploads image data to a region of a texture.
    /// @param target A WebGL texture object instance representing the target
    /// texture object. See textureConstructor().
    /// @param tX The x-coordinate (s-coordinate) of the upper-left corner of
    /// the target rectangle.
    /// @param tY The y-coordinate (t-coordinate) of the upper-left corner of
    /// the target rectangle.
    /// @param tLevel The zero-based index of the target mip-level, where level
    /// zero represents the highest resolution image.
    /// @param source An object storing metadata about the source image.
    /// @param source.levels An array of objects describing each level in the
    /// mipmap chain. Level 0 represents the highest resolution image. Each
    /// level object has width, height, byteSize and byteOffset fields.
    /// @param sLevel The zero-based index of the source mip-level, where level
    /// zero represents the highest resolution image.
    /// @param data An ArrayBuffer storing the raw data for each mip-level of
    /// the source image.
    function uploadTextureRegion(target, tX, tY, tLevel, source, sLevel, data)
    {
        var gl       = target.webglContext;
        var tt       = target.textureTarget;
        var type     = target.dataType;
        var format   = target.format;
        var level    = source.levels[sLevel];
        var lw       = level.width;
        var lh       = level.height;
        var ofs      = level.byteOffset;
        var size     = level.byteSize;
        var view     = null;
        switch (type)
        {
            case gl.UNSIGNED_BYTE:
                view = new Uint8Array(data, ofs, size);
                break;
            case gl.UNSIGNED_SHORT_5_6_5:
            case gl.UNSIGNED_SHORT_5_5_5_1:
            case gl.UNSIGNED_SHORT_4_4_4_4:
                view = new Uint16Array(data, ofs, size >> 1);
                break;

            default: break;
        }
        gl.bindTexture(target.bindTexture, target.textureResource);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(tt, tLevel, tX, tY, lw, lh, format, type, view);
    }

    /// Implements an object constructor for a WebGL buffer object. The
    /// returned object is initialized to a default state.
    /// @param args Arguments being passed to the constructor.
    /// @return A new WebGL buffer resource object.
    function bufferConstructor(args)
    {
        return {
            id             : 0,    /* object list id        */
            bufferResource : null, /* WebGLBuffer instance  */
            webglContext   : null  /* WebGLRenderingContext */
        };
    }

    /// Implements an object destructor for a WebGL buffer object. All
    /// reference fields of the object are set to null. Note that WebGL
    /// resources will not be freed if they are still bound to an active WebGL
    /// rendering context.
    /// @param ref The buffer object being destroyed.
    function bufferDestructor(ref)
    {
        if (ref)
        {
            // release WebGL resources.
            var gl = ref.webglContext;
            gl.deleteBuffer(ref.bufferResource);

            // release references held by the buffer object.
            ref.bufferResource = null;
            ref.webglContext   = null;
        }
    }

    /// Set functions and types exported from the module.
    return exports;
}  (WebGL || {}));
