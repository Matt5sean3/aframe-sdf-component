
// Minimum viable product needs to load the visuals of a robot model

// Keep everything contained to prevent namespace pollution
(function() {

if(typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

var TagHandler = Object.assign(Object.create(null), {
  before: function(node, context) {
    return context;
  },
  after: function(node, context, childResults) {
    return childResults;
  },
  handlers: {},
  use: function(node, context) {
    let ctx = this.before(node, context);
    return this.after(
      node,
      ctx,
      Array.from(node.childNodes)
      .filter(child => child.tagName in handlers || (console.log(child.tagName + " tag not supported") && false))
      .map(child => handlers[child.tagName].use(child, ctx)));
  }
});

var VisualGeometryCylinder = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    var elem = document.createElement("a-cylinder");
    elem.setAttribute("radius", node.querySelector("radius").textContent);
    elem.setAttribute("length", node.querySelector("length").textContent);
    return elem;
  }
});

var VisualGeometrySphere = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    var elem = document.createElement("a-sphere");
    elem.setAttribute("radius", node.querySelector("radius").textContent);
  }
});

var VisualGeometryMesh = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    let uri = node.querySelector("uri").textContent;
    // create a new element
    let elem = document.createElement("a-collada-model");

    // Handle model:// URI resolution
    elem.setAttribute("src", resolveModelUri(uri));
    
    return elem;
  }
});

var VisualGeometry = Object.assign(Object.create(TagHandler), {
  handlers: {
    mesh: VisualGeometryMesh,
    sphere: VisualGeometrySphere,
    cylinder: VisualGeometryCylinder
  }
});

var Visual = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    // Find the geometry first
    let elem = VisualGeometry.use(node.querySelector("geometry"), context);
    // Find the pose second
    let pose = node.querySelector("pose")
      .textContent
      .split(" ")
      .map(parseFloat);

    elem.setAttribute("position", visualPose.slice(0, 3).join(" "));
  
    // Convert roll, pitch, and yaw from radians to degrees
    // TODO is re-ordering these necessary? A-Frame docs says this is Pitch, Yaw, and Roll
    elem.setAttribute("rotation", visualPose
      .slice(3, 6)
      .map(angle => angle * 180 / Math.PI)
      .join(" "));
  
    context.elem.appendChild(elem);
  }
});

var Link = Object.assign(Object.create(TagHandler), {
  before: function(node, context) {
    var linkContext = new Object();
    linkContext.elem = document.createElement("a-entity");
    return linkContext;
  },
  handlers: {
    // TODO support inertial information and collision information
    // inertial: Inertial,
    // collision: Collision,
    visual: Visual
  }
});

function resolveModelUri(uri, context) {
  let modelUriMatch = uri.match(/model:\/\/(.+)$/);
  if(modelUriMatch) {
    let address = modelUriMatch[1];
    while(context) {
      if("modelRoot" in context) {
        return context.modelRoot + address;
      }
      context = context.up;
    }
  }
  return uri;
}

var Model = Object.assign(Object.create(TagHandler), {
  before: function(node, context) {
    var modelContext = new Object();
    modelContext.up = context;
    modelContext.elem = document.createElement("a-entity");

    // resolve model:// URI to Gazebo repo, here for expedience
    if(!context.up)
      modelContext.modelRoot = "http://models.gazebosim.org/";

    if(context) {
      context.down.push(modelContext);
    }
    if("modelNames" in context) {
      context.models[node.getAttribute("name")];
    }
    return modelContext;
  },
  handlers: {
    link: Link
    // TODO implement joints
    // joint: Joint
  },
  after: function(node, modelContext) {
    if("up" in modelContext) {
      let context = modelContext.up;
      if("elem" in context) {
        context.elem.appendChild(modelContext.elem);
      }
    }
  }
});

AFRAME.registerComponent('sdf', {
  // The rest of the information should be in the SDF file
  schema: {
    uri: { type: 'asset' },
    modelroot: { type: 'string', default: 'http://models.gazebosim.org/' }
  },
  init: function() {
    this.namedElems = new Map();
    this.version = 1.5;
  },
  update: function(oldData) {
    // Use the Fetch API to get the model
    if("uri" in oldData || "modelroot" in oldData) {
      console.log("Weird behavior might be caused by changing src mid-simulation ...");
      return;
    }
    this.modelRoot = this.data.modelroot;
    // Load the full SDF document with includes resolved
    // Resolve the model:// URI if necessary
    this.loadSdfDocument(resolveModelUri(this.data.uri, this));
  },
  loadSdfDocument: function(url) {
    // Return a promise resolving to a DOM model
    var request = fetch(url, {
      method: "GET"
    })
    .then(function(response) {
      // Convert to text first
      console.log("Getting response as text");
      return response.text();
    })
    .then(this.validateDoc.bind(this))
    .then(function(text) {
      console.log(text);
      // Parse into a DOM document next
      return new DOMParser().parseFromString(text, "application/xml");
    })
    .then(this.processSdfDocument.bind(this)).catch(function(e) {
      console.log("Error during promise");
    });
  },
  // Creates an A-Frame entity element equivalent to the provided model
  processSdfDocument: function(context, doc) {
    // find the first model in the document
    if(this.validateDoc(doc)) {
      Model.use(doc.documentElement.querySelector("model"), this);
    } else {
      alert("SDF file failed validation");
    }
  },
  validateDoc: function(text) {
    // TODO do validation all in one place
    // TODO validate the document somehow
    // TODO Use xmllint to validate the XSDs
    // XSD root: http://sdformat.org/schemas/root.xsd
    // xmllint:  https://github.com/kripken/xml.js/
    // Cause the promise to fail if there's failed validation
    // Just say it passes for now
    return text;
  },
  remove: function() {
    // Unload the SDF model
  }
});

})();


