# aframe-sdf-component
A Mozilla A-Frame component for loading [Gazebo's](http://gazebosim.org/)
[Simulation Description Format (SDF)](http://sdformat.org/) models as components

## Current Status

Currently, this is in a very preliminary stage. While the ultimate goal is to
eventually add support for all details of SDF implementation, but the way that
the project is proceeding is by adding support for all models in the
[Gazebo model database](http://models.gazebosim.org/) and its
[source repository](https://bitbucket.org/osrf/gazebo_models).

The ultimate test would be to test something analogous to a 3D printer's "Benchy"
that fully tests all details of loading and simulationg an SDF model.

## Goals
The primary goal for this project is to create a means to load SDF files
directly into a Mozilla A-Frame simulation along with working physics based. The
physics simulation aspect is provided by
[Don McCurdy's A-Frame Physics System](https://github.com/donmccurdy/aframe-physics-system)

## Stretch Ideas
Adding the ability to also load [ROS](http://www.ros.org/)
[URDF files](http://wiki.ros.org/urdf) would someday be helpful for a more
general robotics simulation toolkit. However, it may be more advisable to create
a separate repository for such a loader.

