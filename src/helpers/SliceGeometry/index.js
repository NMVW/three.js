// Courtesy of https://github.com/tdhooper/threejs-slice-geometry
// let facesFromEdges = require('./faces-from-edges.js');
import { facesFromEdges } from './faces-from-edges.js';

const SliceGeometry = function(THREE) {

    let FRONT = 'front';
    let BACK = 'back';
    let ON = 'on';

    let FACE_KEYS = ['a', 'b', 'c'];

    let sliceGeometry = function(geometry, plane, closeHoles) {
        let sliced = new THREE.Geometry();
        let builder = new GeometryBuilder(geometry, sliced, plane);

        let distances = [];
        let positions = [];

        geometry.vertices.forEach(function(vertex) {
            let distance = findDistance(vertex, plane);
            let position = distanceAsPosition(distance);
            distances.push(distance);
            positions.push(position);
        });

        geometry.faces.forEach(function(face, faceIndex) {

            let facePositions = FACE_KEYS.map(function(key) {
                return positions[face[key]];
            });

            if (
                facePositions.indexOf(FRONT) === -1 &&
                facePositions.indexOf(BACK) !== -1
            ) {
                return;
            }

            builder.startFace(faceIndex);

            let lastKey = FACE_KEYS[FACE_KEYS.length - 1];
            let lastIndex = face[lastKey];
            let lastDistance = distances[lastIndex];
            let lastPosition = positions[lastIndex];

            FACE_KEYS.map(function(key) {
                let index = face[key];
                let distance = distances[index];
                let position = positions[index];

                if (position === FRONT) {
                    if (lastPosition === BACK) {
                        builder.addIntersection(lastKey, key, lastDistance, distance);
                        builder.addVertex(key);
                    } else {
                        builder.addVertex(key);
                    }
                }

                if (position === ON) {
                    builder.addVertex(key);
                }

                if (position === BACK && lastPosition === FRONT) {
                    builder.addIntersection(lastKey, key, lastDistance, distance);
                }

                lastKey = key;
                lastIndex = index;
                lastPosition = position;
                lastDistance = distance;
            });

            builder.endFace();
        });

        if (closeHoles) {
            builder.closeHoles();
        }

        return sliced;
    };

    let distanceAsPosition = function(distance) {
        if (distance < 0) {
            return BACK;
        }
        if (distance > 0) {
            return FRONT;
        }
        return ON;
    };

    let findDistance = function(vertex, plane) {
        return plane.distanceToPoint(vertex);
    };

    let GeometryBuilder = function(sourceGeometry, targetGeometry, slicePlane) {
        this.sourceGeometry = sourceGeometry;
        this.targetGeometry = targetGeometry;
        this.slicePlane = slicePlane;
        this.addedVertices = [];
        this.addedIntersections = [];
        this.newEdges = [[]];
    };

    GeometryBuilder.prototype.startFace = function(sourceFaceIndex) {
        this.sourceFaceIndex = sourceFaceIndex;
        this.sourceFace = this.sourceGeometry.faces[sourceFaceIndex];
        this.sourceFaceUvs = this.sourceGeometry.faceVertexUvs[0][sourceFaceIndex];

        this.faceIndices = [];
        this.faceNormals = [];
        this.faceUvs = [];
    };

    GeometryBuilder.prototype.endFace = function() {
        let indices = this.faceIndices.map(function(index, i) {
            return i;
        });
        this.addFace(indices);
    };

    GeometryBuilder.prototype.closeHoles = function() {
        if ( ! this.newEdges[0].length) {
            return;
        }
        facesFromEdges(this.newEdges)
            .forEach(function(faceIndices) {
                let normal = this.faceNormal(faceIndices);
                if (normal.dot(this.slicePlane.normal) > .5) {
                    faceIndices.reverse();
                }
                this.startFace();
                this.faceIndices = faceIndices;
                this.endFace();
            }, this);
    };

    GeometryBuilder.prototype.addVertex = function(key) {
        this.addUv(key);
        this.addNormal(key);

        let index = this.sourceFace[key];
        let newIndex;

        if (this.addedVertices.hasOwnProperty(index)) {
            newIndex = this.addedVertices[index];
        } else {
            let vertex = this.sourceGeometry.vertices[index];
            this.targetGeometry.vertices.push(vertex);
            newIndex = this.targetGeometry.vertices.length - 1;
            this.addedVertices[index] = newIndex;
        }
        this.faceIndices.push(newIndex);
    };

    GeometryBuilder.prototype.addIntersection = function(keyA, keyB, distanceA, distanceB) {
        let t = Math.abs(distanceA) / (Math.abs(distanceA) + Math.abs(distanceB));
        this.addIntersectionUv(keyA, keyB, t);
        this.addIntersectionNormal(keyA, keyB, t);

        let indexA = this.sourceFace[keyA];
        let indexB = this.sourceFace[keyB];
        let id = this.intersectionId(indexA, indexB);
        let index;

        if (this.addedIntersections.hasOwnProperty(id)) {
            index = this.addedIntersections[id];
        } else {
            let vertexA = this.sourceGeometry.vertices[indexA];
            let vertexB = this.sourceGeometry.vertices[indexB];
            let newVertex = vertexA.clone().lerp(vertexB, t);
            this.targetGeometry.vertices.push(newVertex);
            index = this.targetGeometry.vertices.length - 1;
            this.addedIntersections[id] = index;
        }
        this.faceIndices.push(index);
        this.updateNewEdges(index);
    };

    GeometryBuilder.prototype.addUv = function(key) {
        if ( ! this.sourceFaceUvs) {
            return;
        }
        let index = this.keyIndex(key);
        let uv = this.sourceFaceUvs[index];
        this.faceUvs.push(uv);
    };

    GeometryBuilder.prototype.addIntersectionUv = function(keyA, keyB, t) {
        if ( ! this.sourceFaceUvs) {
            return;
        }
        let indexA = this.keyIndex(keyA);
        let indexB = this.keyIndex(keyB);
        let uvA = this.sourceFaceUvs[indexA];
        let uvB = this.sourceFaceUvs[indexB];
        let uv = uvA.clone().lerp(uvB, t);
        this.faceUvs.push(uv);
    };

    GeometryBuilder.prototype.addNormal = function(key) {
        if ( ! this.sourceFace.vertexNormals.length) {
            return;
        }
        let index = this.keyIndex(key);
        let normal = this.sourceFace.vertexNormals[index];
        this.faceNormals.push(normal);
    };

    GeometryBuilder.prototype.addIntersectionNormal = function(keyA, keyB, t) {
        if ( ! this.sourceFace.vertexNormals.length) {
            return;
        }
        let indexA = this.keyIndex(keyA);
        let indexB = this.keyIndex(keyB);
        let normalA = this.sourceFace.vertexNormals[indexA];
        let normalB = this.sourceFace.vertexNormals[indexB];
        let normal = normalA.clone().lerp(normalB, t).normalize();
        this.faceNormals.push(normal);
    };

    GeometryBuilder.prototype.addFace = function(indices) {
        if (indices.length === 3) {
            this.addFacePart(indices[0], indices[1], indices[2]);
            return;
        }

        let pairs = [];
        for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
                let diff = Math.abs(i - j);
                if (diff > 1 && diff < indices.length - 1) {
                    pairs.push([indices[i], indices[j]]);
                }
            }
        }

        pairs.sort(function(pairA, pairB) {
            let lengthA = this.faceEdgeLength(pairA[0], pairA[1]);
            let lengthB = this.faceEdgeLength(pairB[0], pairB[1]);
            return lengthA - lengthB;
        }.bind(this));

        let a = indices.indexOf(pairs[0][0]);
        indices = indices.slice(a).concat(indices.slice(0, a));

        let b = indices.indexOf(pairs[0][1]);
        let indicesA = indices.slice(0, b + 1);
        let indicesB = indices.slice(b).concat(indices.slice(0, 1));

        this.addFace(indicesA);
        this.addFace(indicesB);
    };

    GeometryBuilder.prototype.addFacePart = function(a, b, c) {
        let normals = null;
        if (this.faceNormals.length) {
            normals = [
                this.faceNormals[a],
                this.faceNormals[b],
                this.faceNormals[c],
            ];
        }
        let face = new THREE.Face3(
            this.faceIndices[a],
            this.faceIndices[b],
            this.faceIndices[c],
            normals
        );
        this.targetGeometry.faces.push(face);
        if ( ! this.sourceFaceUvs) {
            return;
        }
        this.targetGeometry.faceVertexUvs[0].push([
            this.faceUvs[a],
            this.faceUvs[b],
            this.faceUvs[c]
        ]);
    };

    GeometryBuilder.prototype.faceEdgeLength = function(a, b) {
        let indexA = this.faceIndices[a];
        let indexB = this.faceIndices[b];
        let vertexA = this.targetGeometry.vertices[indexA];
        let vertexB = this.targetGeometry.vertices[indexB];
        return vertexA.distanceToSquared(vertexB);
    };

    GeometryBuilder.prototype.intersectionId = function(indexA, indexB) {
        return [indexA, indexB].sort().join(',');
    };

    GeometryBuilder.prototype.keyIndex = function(key) {
        return FACE_KEYS.indexOf(key);
    };

    GeometryBuilder.prototype.updateNewEdges = function(index) {
        let edgeIndex = this.newEdges.length - 1;
        let edge = this.newEdges[edgeIndex];
        if (edge.length < 2) {
            edge.push(index);
        } else {
            this.newEdges.push([index]);
        }
    };

    GeometryBuilder.prototype.faceNormal = function(faceIndices) {
        let vertices = faceIndices.map(function(index) {
            return this.targetGeometry.vertices[index];
        }.bind(this));
        let edgeA = vertices[0].clone().sub(vertices[1]);
        let edgeB = vertices[0].clone().sub(vertices[2]);
        return edgeA.cross(edgeB).normalize();
    };

    return sliceGeometry;
};

export { SliceGeometry };
