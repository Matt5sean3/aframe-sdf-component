
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
    let handled = Array.from(node.childNodes)
      .filter(child => "tagName" in child)
      .filter(child => child.tagName in this.handlers || (console.log(child.tagName + " tag not supported") && false))
      .reduce((current, child) => {
        let childResult = this.handlers[child.tagName].use(child, ctx);
        current[child.tagName] = child.tagName in current ?
          current[child.tagName].concat([childResult]) :
          [childResult];
        return current;
      }, Object.create(null));
    return this.after(
      node,
      ctx,
      handled);
  }
});

// Using GZWeb I can probably lift some parts awayy
var VisualGeometryCylinder = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    var elem = document.createElement("a-cylinder");
    elem.setAttribute("radius", node.querySelector("radius").textContent);
    elem.setAttribute("height", node.querySelector("length").textContent);
    return elem;
  }
});

var VisualGeometrySphere = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    var elem = document.createElement("a-sphere");
    elem.setAttribute("radius", node.querySelector("radius").textContent);
    return elem;
  }
});

var VisualGeometryMesh = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    let uri = node.querySelector("uri").textContent;
    // create a new element
    let elem = document.createElement("a-collada-model");

    // Handle model:// URI resolution
    elem.setAttribute("src", resolveModelUri(uri, context));
    
    return elem;
  }
});

var VisualGeometry = Object.assign(Object.create(TagHandler), {
  handlers: {
    mesh: VisualGeometryMesh,
    sphere: VisualGeometrySphere,
    cylinder: VisualGeometryCylinder
  },
  after: function(node, context, childResults) {
    var resultKey = Object.keys(childResults)[0];
    return childResults[resultKey][0];
  }
});

var Numbers = Object.assign(Object.create(TagHandler), {
  use: function(node, context) {
    return node.textContent.split(" ")
	  .map(parseFloat);
  }
});

var Visual = Object.assign(Object.create(TagHandler), {
  handlers: {
    "geometry": VisualGeometry,
    "pose": Numbers
  },
  after: function(node, context, childResults) {
    // Use Three.js directly for visual, rather than making sub-objects
    let elem = childResults.geometry[0];
    let pose = childResults.pose[0];
    let elemPos = elem.object3D.position;
    elemPos.set.apply(elemPos, pose.slice(0, 3));
    // Convert roll, pitch, and yaw from radians to degrees
    // TODO is re-ordering these necessary? A-Frame docs says this is Pitch, Yaw, and Roll
    elem.setAttribute("rotation", pose
      .slice(3, 6)
      .map(angle => angle * 180 / Math.PI)
      .join(" "));
    var position = elem.getAttribute("position");
    return elem;
  }
});

var Link = Object.assign(Object.create(TagHandler), {
  before: function(node, context) {
    var linkContext = Object.create(null);
    linkContext.up = context;
    linkContext.el = document.createElement("a-entity");
    return linkContext;
  },
  handlers: {
    // TODO support inertial information and collision information
    // inertial: Inertial,
    // collision: Collision,
    visual: Visual
  },
  after: function(node, context, childResults) {
    let elem = document.createElement("a-entity");
    if("visual" in childResults)
      elem.appendChild(childResults.visual[0]);
    return elem;
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

    // resolve model:// URI to Gazebo repo, here for expedience
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
  after: function(node, modelContext, childResults) {
    // Need to attach all links
    var elem = document.createElement("a-entity");
    childResults.link.forEach(childElem => elem.appendChild(childElem));
    return elem;
  }
});

AFRAME.registerSystem('sdf-root', {
  schema: {
    type: 'string', default: 'models/'
  },
  init: function() {
  }
});

AFRAME.registerComponent('sdf', {
  // The rest of the information should be in the SDF file
  schema: {
    type: 'asset'
  },
  init: function() {
    this.namedElems = new Map();
    this.version = 1.5;
  },
  update: function(oldData) {
    // Use the Fetch API to get the model
    if(oldData && ("uri" in oldData || "modelroot" in oldData)) {
      console.log("Weird behavior might be caused by changing src mid-simulation ...");
      return;
    }
    this.modelRoot = this.el.sceneEl.systems["sdf-root"].data;
    // Load the full SDF document with includes resolved
    // Resolve the model:// URI if necessary
    this.loadSdfDocument(resolveModelUri(this.data, this));
  },
  loadSdfDocument: function(url) {
    // Return a promise resolving to a DOM model
    var request = fetch(new Request(url), {
      method: "GET",
      mode: "same-origin"
    })
    .then(function(response) {
      // Convert to text first
      console.log("Getting response as text");
      console.log(response.ok);
      console.log(response.status);
      for(let entry in response) {
        console.log(entry + ": " +  response[entry]);
      }
      console.log("Headers");
      for(let pair of response.headers) {
        console.log(pair[0] + ": " + pair[1]);
      }
      return response.text();
    })
    .then(this.validateDoc.bind(this))
    .then(function(text) {
      console.log(text);
      // Parse into a DOM document next
      return new DOMParser().parseFromString(text, "application/xml");
    })
    .then(this.processSdfDocument.bind(this)).catch(function(e) {
      console.log(e.message);
      console.log("Error during promise");
    });
  },
  // Creates an A-Frame entity element equivalent to the provided model
  processSdfDocument: function(doc) {
    // find the first model in the document
    this.el.appendChild(Model.use(doc.documentElement.querySelector("model"), this));
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


