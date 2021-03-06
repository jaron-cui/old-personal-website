
// Constants
SCREENWIDTH = 600
SCREENHEIGHT = 400
MOVESPEED = 2
PANSPEED = .8
PANLIMIT = 89

var keys = new Set()

document.addEventListener("keydown", key => keys.add(key["key"]))
document.addEventListener("keyup", key => keys.delete(key["key"]))

var cameraActions = new Map()
var pitch = 0
var yaw = 0

function moveCamera(pos, vec, direction, scale) {
    return [addVectors(pos, scaleVector(direction, scale * MOVESPEED)), vec]
}
function panCamera(yawScale, pitchScale) {
    return (pos, vec) => {
        pitch = Math.max(Math.min(pitch + pitchScale * PANSPEED, PANLIMIT), -PANLIMIT)
        yaw += yawScale * PANSPEED
        return [pos, recalculateCameraVector()]
    }
}
// Camera-level movement controls
cameraActions.set("w", (pos, vec) => moveCamera(pos, vec, vec, 1))
cameraActions.set("a", (pos, vec) => moveCamera(pos, vec, screenXVector(vec), -1))
cameraActions.set("s", (pos, vec) => moveCamera(pos, vec, vec, -1))
cameraActions.set("d", (pos, vec) => moveCamera(pos, vec, screenXVector(vec), 1))
// Camera-vertical movement controls
cameraActions.set("e", (pos, vec) => moveCamera(pos, vec, screenYVector(vec), 1))
cameraActions.set("q", (pos, vec) => moveCamera(pos, vec, screenYVector(vec), -1))
// Camera panning controls
cameraActions.set("i", panCamera(0, 1))
cameraActions.set("k", panCamera(0, -1))
cameraActions.set("j", panCamera(-1, 0))
cameraActions.set("l", panCamera(1, 0))

function toRadians(degrees) {
    return degrees / 180 * Math.PI
}

function recalculateCameraVector() {
    var radPitch = toRadians(pitch)
    var radYaw = toRadians(yaw)
    var horizontalComponent = Math.abs(Math.cos(radPitch))

    var xComponent = horizontalComponent*Math.cos(radYaw)
    var yComponent = horizontalComponent*Math.sin(radYaw)
    var zComponent = Math.sin(radPitch)
    return [xComponent, yComponent, zComponent]
}

function handleCameraMovement(cameraPosition, cameraVector) {
    var acc = [cameraPosition.slice(), cameraVector.slice()]
    for (var key of keys) {
        if (cameraActions.has(key)) {
            acc = cameraActions.get(key)(acc[0], acc[1])
            needsUpdate = true
        }
    }
    return acc
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var pointMap = new Map()
needsUpdate = true
async function loop() {
    var cameraVector = [1, 0, 0]
    var cameraPosition = [0, 0, 0]
    var geometries = [new Geometry([400, 120, 0], [new Face("red", [[10, -30, -20], [50, 70, -50], [80, 100, 150]])]),
        new Cube([600, 0, 0], "green", 100), new Cube([500, -50, 100], "purple", 69), new Cube([80, -30, -20], "blue", 30)]
    var display = document.getElementById("display")
    
    while (!keys.has("Escape")) {
        if (needsUpdate) {
            console.log("UPDATED")
            pointMap.clear()
            display.innerHTML = ""
            var cameraBasis = invertMatrix(transpose([screenXVector(cameraVector), screenYVector(cameraVector), cameraVector]))
            var faces = []
            // Collect the faces of all geometries (recorded in global coordinates)
            for (group of geometries.map(g => g.getFaces())) {
            faces = faces.concat(group)
            }
            for (var face of sortFaces(faces, cameraPosition)) {
                var polygon = face.htmlScreenPolygon(cameraPosition, cameraBasis)
                display.appendChild(polygon)
            }
            // Crosshair
            display.appendChild(htmlBar([SCREENWIDTH / 2, SCREENHEIGHT / 2], 20))
            display.appendChild(htmlPole([SCREENWIDTH / 2, SCREENHEIGHT / 2], 20))

            // Angular indicators
            display.appendChild(htmlBar([SCREENWIDTH / 2, pitch * SCREENHEIGHT / 180 + SCREENHEIGHT / 2], 10))
            var yawIndicatorPos = (Math.abs(yaw) % 360 < 180 ? 0 : Math.sign(yaw) * 360) - yaw % 360
            display.appendChild(htmlPole([yawIndicatorPos * SCREENWIDTH / 360 + SCREENWIDTH / 2, SCREENHEIGHT / 2], 10))
            needsUpdate = false
        }

        geometries[1].rotate(0, 0, 1)
        geometries[0].rotate(.1, .2, 0)
        geometries[2].rotate(.05, 0, .1)
        geometries[3].rotate(0, 0, -.025)
        var newCam = handleCameraMovement(cameraPosition, cameraVector)
        cameraPosition = newCam[0]
        cameraVector = newCam[1]

        await sleep(10)
    }
}

function htmlLine(center, x1, y1, x2, y2) {
    var line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1", (x1 + center[0]).toString());
    line.setAttribute("y1", (y1 + center[1]).toString());
    line.setAttribute("x2", (x2 + center[0]).toString());
    line.setAttribute("y2", (y2 + center[1]).toString());
    line.setAttribute("stroke", "black")
    return line
}

function htmlBar(center, length) {
    var lineRad = length / 2
    return htmlLine(center, -lineRad, 0, lineRad, 0)
}

function htmlPole(center, length) {
    var lineRad = length / 2
    return htmlLine(center, 0, -lineRad, 0, lineRad)
}

function sortFaces(faces, cameraPosition) {
    var tagged = []
    for (var face of faces) {
        tagged.push([distance(cameraPosition, face.center), face])
    }

    return mergeSort(tagged).map(x => x[1])

    function merge(facesA, facesB) {
        var merged = []
        var current = [facesA, 0]
        var other = [facesB, 0]
        while (current[1] < current[0].length && other[1] < other[0].length) {
            var currentFace = current[0][current[1]]
            var otherFace = other[0][other[1]]
            if (currentFace[0] <= otherFace[0]) {
                var temp = current
                current = other
                other = temp
            }
            merged.push(current[0][current[1]])
            current[1] += 1
        }
        for (var taggedFace of other[1] == other[0].length ? current[0].slice(current[1]) : other[0].slice(other[1])) {
            merged.push(taggedFace)
        }
        return merged
    }

    function mergeSort(taggedFaces) {
        if (taggedFaces.length <= 1) {
            return taggedFaces
        }
        var split = Math.floor(taggedFaces.length / 2)
        var firstHalf = mergeSort(taggedFaces.slice(0, split))
        var secondHalf = mergeSort(taggedFaces.slice(split, taggedFaces.length))
        return merge(firstHalf, secondHalf)
    }
}

function distance(a, b) {
    var delta = addVectors(a, scaleVector(b, -1))
    var total = 0
    for (var component of delta) {
        total += component*component
    }
    return Math.sqrt(total)
}

function roundTo(number, places) {
    var factor = Math.pow(10, places)
    return Math.round(number * factor) / factor
}

function roundVector(vector) {
    return vector.map(x => Math.round(x))
}

function screenPosition(point, cameraPosition, cameraBasis) {
    var key = String(roundVector(point))
    if (pointMap.has(key)) {
        return pointMap.get(key)
    }
    var point = addVectors(point, scaleVector(cameraPosition, -1))
    var converted = multiplyMatrixVector(cameraBasis, point)
    if (converted[2] < 0) {
        return [null, null]
    }
    var distanceScale = 600/converted[2]
    var x = converted[0]
    var y = converted[1]
    var screenPos = [distanceScale*x + SCREENWIDTH/2, SCREENHEIGHT/2 - distanceScale*y]
    pointMap.set(key, screenPos)
    return screenPos
}

function multiplyMatrixVector(matrix, vector) {
    var output = []
    for (y = 0; y < 3; y += 1) {
        var element = 0
        for (x = 0; x < 3; x += 1) {
            element += vector[x]*matrix[y][x]
        }
        output[y] = element
    }
    return output
}

function multiplyMatrices(matrixA, matrixB) {
    var products = []
    for (column of transpose(matrixB)) {
        products.push(multiplyMatrixVector(matrixA, column))
    }
    return transpose(products)
}

function screenXVector(vector) {
    var radYaw = toRadians(yaw)
    var x = Math.cos(radYaw)
    var y = Math.sin(radYaw)
    return [-y, x, 0]
}

function screenYVector(vector) {
    var x = vector[0]
    var y = vector[1]
    var z = vector[2]
    var direction = unitVector([-x*z, -y*z, (x*x + y*y)])
    return direction
}

function rotationMatrixX(theta) {
    return [[1, 0, 0], [0, Math.cos(theta), -Math.sin(theta)], [0, Math.sin(theta), Math.cos(theta)]]
}

function rotationMatrixY(theta) {
    return [[Math.cos(theta), 0, Math.sin(theta)], [0, 1, 0], [-Math.sin(theta), 0, Math.cos(theta)]]
}

function rotationMatrixZ(theta) {
    return [[Math.cos(theta), -Math.sin(theta), 0], [Math.sin(theta), Math.cos(theta), 0], [0, 0, 1]]
}

function addVectors(vector1, vector2) {
    return [vector1[0] + vector2[0], vector1[1] + vector2[1], vector1[2] + vector2[2]]
}

function unitVector(vector) {
    return scaleVector(vector, 1/vectorLength(vector))
}

function vectorLength(vector) {
    var x = vector[0]
    var y = vector[1]
    var z = vector[2]
    return Math.sqrt(x*x + y*y + z*z)
}

function scaleVector(vector, factor) {
    var x = vector[0]
    var y = vector[1]
    var z = vector[2]
    return [factor*x, factor*y, factor*z]
}

function transpose(matrix) {
    var transposed = []
    for (var y = 0; y < matrix[0].length; y += 1) {
        var row = []
        for (var x = 0; x < matrix.length; x += 1) {
            row.push(matrix[x][y])
        }
        transposed.push(row)
    }
    return transposed
}

function invertMatrix(matrix) {
    var row1, row2, row3
    var inv1, inv2, inv3
    
    // Orders the rows so that the first element of the first row is nonzero,
    // the second element of the second row is nonzero, and the third of
    // the third row is nonzero.
    var rows = [matrix[0].slice(), matrix[1].slice(), matrix[2].slice()]
    var identityRows = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

    for (i = 0; i < 3; i += 1) {
        if (rows[i][0] != 0) {
            var others = [0, 1, 2].filter(x => x != i)
            if (rows[others[0]][2] != 0 && rows[others[1]][1] != 0) {
                var temp = others[0]
                others[0] = others[1]
                others[1] = temp
            } else if (rows[others[0]][1] == 0 || rows[others[1]][2] == 0) {
                continue
            }
            row1 = rows[i]
            row2 = rows[others[0]]
            row3 = rows[others[1]]
            inv1 = identityRows[i]
            inv2 = identityRows[others[0]]
            inv3 = identityRows[others[1]]
            break
        }
    }
    // BUG ORIGINATES HERE - I HYPOTHESIZE THAT THIS DOESN'T ALWAYS ORDER CORRECTLY

    // If this cannot be done, the matrix has no inverse.
    if (inv1 == null) {
        return null
    }

    var scale

    // Scales the first row so that the first element is 1. [1, b, c]
    scale = 1/row1[0]
    row1 = scaleVector(row1, scale)
    inv1 = scaleVector(inv1, scale)

    // Zeroes the first elements of the first and second rows. [0, b, c]
    scale = -row2[0]
    row2 = addVectors(row2, scaleVector(row1, scale))
    inv2 = addVectors(inv2, scaleVector(inv1, scale))
    scale = -row3[0]
    row3 = addVectors(row3, scaleVector(row1, scale))
    inv3 = addVectors(inv3, scaleVector(inv1, scale))

    // Scales the second row so that the second element is 1. [0, 1, c]
    scale = 1/row2[1]
    row2 = scaleVector(row2, scale)
    inv2 = scaleVector(inv2, scale)

    // Zeroes the second element of the third row.
    scale = -row3[1]
    row3 = addVectors(row3, scaleVector(row2, scale))
    inv3 = addVectors(inv3, scaleVector(inv2, scale))

    // Scales the third row so that the third element is 1. [0, 0, 1]
    scale = 1/row3[2]
    row3 = scaleVector(row3, scale)
    inv3 = scaleVector(inv3, scale)

    // Zeroes the third element of the second row. [0, 1, 0]
    scale = -row2[2]
    row2 = addVectors(row2, scaleVector(row3, scale))
    inv2 = addVectors(inv2, scaleVector(inv3, scale))

    // Zeroes the second and third elements of the first row. [1, 0, 0]
    scale = -row1[1]
    row1 = addVectors(row1, scaleVector(row2, scale))
    inv1 = addVectors(inv1, scaleVector(inv2, scale))
    scale = -row1[2]
    row1 = addVectors(row1, scaleVector(row3, scale))
    inv1 = addVectors(inv1, scaleVector(inv3, scale))

    var output = []
    output[0] = inv1
    output[1] = inv2
    output[2] = inv3
    return output
}

function vectorToString(vector) {
    var copy = vector.slice()
    if (copy.length == 0) {
        return "<>"
    }
    var output = "<"
    var last = copy.pop()
    for (component of copy) {
        output += (Math.round(component * 100) / 100) + ", "
    }
    return output + (Math.round(last * 100) / 100) + ">"
}

function matrixToString(matrix) {
    var copy = matrix.slice()
    if (copy.length == 0) {
        return "<>"
    }
    var output = "<"
    var last = copy.pop()
    for (row of copy) {
        output += vectorToString(row) + "\n "
    }
    return output + vectorToString(last) + ">"
}

function blankScreen() {
    var output = []
    for (y = 0; y < 20; y += 1) {
        var row = []
        for (x = 0; x < 30; x += 1) {
            row[x] = "&nbsp&nbsp&nbsp"
        }
        output[y] = row
    }
    return output
}

function renderScreen(pixels) {
    var output = ""
    pixels.forEach(row => {
        row.forEach(pixel => {
            output += pixel
        })
        output += "\n"
    });
    return output
}

// GEOMETRY

function pointAverage(points) {
    var temp = points.slice()
    function recurse(rest) {
        if (rest.length > 1) {
            return addVectors(rest.pop(), recurse(rest))
        } else {
            return rest[0]
        }
    }
    var n = temp.length
    return scaleVector(addVectors(temp.pop(), recurse(temp)), 1/n)
}

// Represents a geometric face in 3D Cartesian space
class Face {
    // constructor taking in the color of the face and its 3D points
    constructor(color, points) {
        this.color = color
        this.points = points.slice()
        this.center = pointAverage(points)
    }

    // Returns a translated copy of this face
    translate(delta) {
        return new Face(this.color, this.points.map(point => addVectors(point, delta)))
    }

    transformPoints(matrix) {
        return new Face(this.color, this.points.map(point => multiplyMatrixVector(matrix, point)))
    }

    // Returns an array of the face points mapped onto the screen in the form [x, y]
    screenPoints(cameraPosition, cameraBasis) {
        var converted = []
        for (var point of this.points) {
            converted.push(screenPosition(point, cameraPosition, cameraBasis))
        }
        return converted
    }

    // Returns an SVG polygon HTML element as the face should be rendered 
    htmlScreenPolygon(cameraPosition, cameraBasis) {
        var points = ""
        for (var point of this.screenPoints(cameraPosition, cameraBasis)) {
            points += point[0] + "," + point[1] + " "

            /*if (point[0] < 0 || point[0] >= SCREENWIDTH ||
                point[1] < 0 || point[1] >= SCREENHEIGHT) {
                points = ""
                break;
            }*/
        }

        var polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
        polygon.setAttribute("points", points)
        polygon.setAttribute("style", "fill:" + this.color +";stroke:black;stroke-width:1;fill-rule:evenodd;")

        return polygon
    }
}

// Represents a 3D geometry
class Geometry {
    constructor(position, faces) {
        this.position = position
        this.faces = faces
        this.rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    }

    getFaces() {
        return this.faces.map(face => face.transformPoints(this.rotation).translate(this.position))
    }

    rotate(x, y, z) {
        var transforms = [x, y, z]
        var matrixGenerators = [rotationMatrixX, rotationMatrixY, rotationMatrixZ]
        for (i = 0; i < 3; i += 1) {
            if (transforms[i] == 0) {
                continue
            } else {
                this.rotation = multiplyMatrices(this.rotation, matrixGenerators[i](toRadians(transforms[i])))
                needsUpdate = true
            }
        }
    }
}

class Cube extends Geometry {
    constructor(position, color, scale) {
        var w = scale / 2
        var corners = [[-w, -w, -w], [-w, -w, w], [-w, w, w], [-w, w, -w],
                 [w, -w, -w], [w, -w, w], [w, w, w], [w, w, -w]]
        var facesPoints = [[0, 1, 2, 3], [0, 1, 5, 4], [0, 4, 7, 3], 
                           [2, 6, 7, 3], [1, 5, 6, 2], [4, 5, 6, 7]]
        super(position, facesPoints.map(indices => new Face(color, indices.map(i => corners[i]))))
    }
}

loop()