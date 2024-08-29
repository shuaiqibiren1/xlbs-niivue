import { vec3 } from 'gl-matrix'
import { NVMesh, MeshType } from './nvmesh.js'
import { NVUtilities } from './nvutilities.js'
import { NiivueObject3D } from './niivue-object3D.js'
import { NVMeshUtilities } from './nvmesh-utilities.js'
import { cmapper } from './colortables.js'
import { NVLabel3D, LabelTextAlignment, LabelLineTerminator } from './nvlabel.js'
import { Connectome, ConnectomeOptions, LegacyConnectome, NVConnectomeEdge, NVConnectomeNode } from './types.js'
import { log } from './logger.js'

const defaultOptions: ConnectomeOptions = {
  name: 'untitled connectome',
  nodeColormap: 'warm',
  nodeColormapNegative: 'winter',
  nodeMinColor: 0,
  nodeMaxColor: 4,
  nodeScale: 3,
  edgeColormap: 'warm',
  edgeColormapNegative: 'winter',
  edgeMin: 2,
  edgeMax: 6,
  edgeScale: 1,
  legendLineThickness: 0
}

export type FreeSurferConnectome = {
  data_type: string
  points: Array<{
    comments?: Array<{
      text: string
    }>
    coordinates: {
      x: number
      y: number
      z: number
    }
  }>
}

/**
 * Represents a connectome
 */
export class NVConnectome extends NVMesh {
  gl: WebGL2RenderingContext
  nodesChanged: EventTarget

  constructor(gl: WebGL2RenderingContext, connectome: LegacyConnectome) {
    super(new Float32Array([]), new Uint32Array([]), connectome.name, new Uint8Array([]), 1.0, true, gl, connectome)
    this.gl = gl
    // this.nodes = connectome.nodes;
    // this.edges = connectome.edges;
    // this.options = { ...defaultOptions, ...connectome };
    this.type = MeshType.CONNECTOME
    if (this.nodes) {
      this.updateLabels()
    }

    this.nodesChanged = new EventTarget()
  }

  static convertLegacyConnectome(json: LegacyConnectome): Connectome {
    const connectome: Connectome = { nodes: [], edges: [], ...defaultOptions }
    for (const prop in json) {
      if (prop in defaultOptions) {
        const key = prop as keyof ConnectomeOptions
        // @ts-expect-error -- this will work, as both extend ConnectomeOptions
        connectome[key] = json[key]
      }
    }
    const nodes = json.nodes
    for (let i = 0; i < nodes.names.length; i++) {
      connectome.nodes.push({
        name: nodes.names[i],
        x: nodes.X[i],
        y: nodes.Y[i],
        z: nodes.Z[i],
        colorValue: nodes.Color[i],
        sizeValue: nodes.Size[i]
      })
    }

    for (let i = 0; i < nodes.names.length - 1; i++) {
      for (let j = i + 1; j < nodes.names.length; j++) {
        const colorValue = json.edges[i * nodes.names.length + j]
        connectome.edges.push({
          first: i,
          second: j,
          colorValue
        })
      }
    }

    return connectome
  }

  static convertFreeSurferConnectome(json: FreeSurferConnectome, colormap = 'warm'): Connectome {
    let isValid = true
    if (!('data_type' in json)) {
      isValid = false
    } else if (json.data_type !== 'fs_pointset') {
      isValid = false
    }
    if (!('points' in json)) {
      isValid = false
    }
    if (!isValid) {
      throw Error('not a valid FreeSurfer json pointset')
    }

    const nodes = json.points.map((p) => ({
      name: Array.isArray(p.comments) && p.comments.length > 0 && 'text' in p.comments[0] ? p.comments[0].text : '',
      x: p.coordinates.x,
      y: p.coordinates.y,
      z: p.coordinates.z,
      colorValue: 1,
      sizeValue: 1,
      metadata: p.comments
    }))
    const connectome = {
      ...defaultOptions,
      nodeColormap: colormap,
      edgeColormap: colormap,
      nodes,
      edges: []
    }
    return connectome
  }

  updateLabels(): void {
    const nodes = this.nodes as NVConnectomeNode[]
    if (nodes && nodes.length > 0) {
      // largest node
      const largest = (nodes as NVConnectomeNode[]).reduce((a, b) => (a.sizeValue > b.sizeValue ? a : b)).sizeValue
      const min = this.nodeMinColor
        ? this.nodeMinColor
        : nodes.reduce((a, b) => (a.colorValue < b.colorValue ? a : b)).colorValue
      const max = this.nodeMaxColor
        ? this.nodeMaxColor
        : nodes.reduce((a, b) => (a.colorValue > b.colorValue ? a : b)).colorValue
      const lut = cmapper.colormap(this.nodeColormap, this.colormapInvert)
      const lutNeg = cmapper.colormap(this.nodeColormapNegative, this.colormapInvert)
      const hasNeg = 'nodeColormapNegative' in this
      const legendLineThickness = this.legendLineThickness ? this.legendLineThickness : 0.0

      for (let i = 0; i < nodes.length; i++) {
        let color = nodes[i].colorValue
        let isNeg = false
        if (hasNeg && color < 0) {
          isNeg = true
          color = -color
        }

        if (min < max) {
          if (color < min) {
            log.warn('color value lower than min')
            continue
          }
          color = (color - min) / (max - min)
        } else {
          color = 1.0
        }

        color = Math.round(Math.max(Math.min(255, color * 255))) * 4
        let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
        if (isNeg) {
          rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
        }
        rgba = rgba.map((c) => c / 255)
        log.debug('adding label for ', nodes[i])
        nodes[i].label = new NVLabel3D(
          nodes[i].name,
          {
            textColor: rgba,
            bulletScale: nodes[i].sizeValue / largest,
            bulletColor: rgba,
            lineWidth: legendLineThickness,
            lineColor: rgba,
            textScale: 1.0,
            textAlignment: LabelTextAlignment.LEFT,
            lineTerminator: LabelLineTerminator.NONE
          },
          [nodes[i].x, nodes[i].y, nodes[i].z]
        )
        log.debug('label for node:', nodes[i].label)
      }
    }
  }

  addConnectomeNode(node: NVConnectomeNode): void {
    log.debug('adding node', node)
    if (!this.nodes) {
      throw new Error('nodes not defined')
    }

    ;(this.nodes as NVConnectomeNode[]).push(node)
    this.updateLabels()
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeAdded', { detail: { node } }))
  }

  deleteConnectomeNode(node: NVConnectomeNode): void {
    // delete any connected edges
    const index = (this.nodes as NVConnectomeNode[]).indexOf(node)
    const edges = this.edges as NVConnectomeEdge[]
    if (edges) {
      this.edges = edges.filter((e) => e.first !== index && e.second !== index)
    }
    this.nodes = (this.nodes as NVConnectomeNode[]).filter((n) => n !== node)

    this.updateLabels()
    this.updateConnectome(this.gl)
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeDeleted', { detail: { node } }))
  }

  updateConnectomeNodeByIndex(index: number, updatedNode: NVConnectomeNode): void {
    ;(this.nodes as NVConnectomeNode[])[index] = updatedNode
    this.updateLabels()
    this.updateConnectome(this.gl)
    this.nodesChanged.dispatchEvent(new CustomEvent('nodeChanged', { detail: { node: updatedNode } }))
  }

  updateConnectomeNodeByPoint(point: [number, number, number], updatedNode: NVConnectomeNode): void {
    // TODO this was updating nodes in this.connectome.nodes
    const nodes = this.nodes as NVConnectomeNode[]
    if (!nodes) {
      throw new Error('Node to update does not exist')
    }
    const node = nodes.find((node) => NVUtilities.arraysAreEqual([node.x, node.y, node.z], point))
    if (!node) {
      throw new Error(`Node with point ${point} to update does not exist`)
    }
    const index = nodes.findIndex((n) => n === node)
    this.updateConnectomeNodeByIndex(index, updatedNode)
  }

  addConnectomeEdge(first: number, second: number, colorValue: number): NVConnectomeEdge {
    const edges = this.edges as NVConnectomeEdge[]
    let edge = edges.find((f) => (f.first === first || f.second === first) && f.first + f.second === first + second)
    if (edge) {
      return edge
    }
    edge = { first, second, colorValue }
    edges.push(edge)
    this.updateConnectome(this.gl)
    return edge
  }

  deleteConnectomeEdge(first: number, second: number): NVConnectomeEdge {
    const edges = this.edges as NVConnectomeEdge[]

    const edge = edges.find((f) => (f.first === first || f.first === second) && f.first + f.second === first + second)
    if (edge) {
      this.edges = edges.filter((e) => e !== edge)
    } else {
      throw new Error(`edge between ${first} and ${second} not found`)
    }
    this.updateConnectome(this.gl)
    return edge
  }

  findClosestConnectomeNode(point: number[], distance: number): NVConnectomeNode | null {
    const nodes = this.nodes as NVConnectomeNode[]
    if (!nodes || nodes.length === 0) {
      return null
    }

    const closeNodes = nodes
      .map((n, i) => ({
        node: n,
        distance: Math.sqrt(Math.pow(n.x - point[0], 2) + Math.pow(n.y - point[1], 2) + Math.pow(n.z - point[2], 2)),
        index: i
      }))
      .filter((n) => n.distance < distance)
      .sort((a, b) => a.distance - b.distance)
    if (closeNodes.length > 0) {
      return closeNodes[0].node
    } else {
      return null
    }
  }

  updateConnectome(gl: WebGL2RenderingContext): void {
    const tris: number[] = []
    const pts: number[] = []
    const rgba255: number[] = []
    let lut = cmapper.colormap(this.nodeColormap, this.colormapInvert)
    let lutNeg = cmapper.colormap(this.nodeColormapNegative, this.colormapInvert)
    let hasNeg = 'nodeColormapNegative' in this

    // TODO this should not be able to occur; fix this in the constructor by deterministically assigning the values
    if (this.nodeMinColor === undefined || this.nodeMaxColor === undefined) {
      throw new Error('nodeMinColor or nodeMaxColor is undefined')
    }
    // TODO should this be edge[Min|Max]Color?
    if (this.edgeMin === undefined || this.edgeMax === undefined) {
      throw new Error('edgeMin or edgeMax undefined')
    }

    let min = this.nodeMinColor
    let max = this.nodeMaxColor

    // TODO these statements can be removed once the node types are clened up
    const nodes = this.nodes as NVConnectomeNode[]
    const nNode = nodes.length
    for (let i = 0; i < nNode; i++) {
      const radius = nodes[i].sizeValue * this.nodeScale
      if (radius <= 0.0) {
        continue
      }
      let color = nodes[i].colorValue
      let isNeg = false
      if (hasNeg && color < 0) {
        isNeg = true
        color = -color
      }
      if (min < max) {
        if (color < min) {
          continue
        }
        color = (color - min) / (max - min)
      } else {
        color = 1.0
      }
      color = Math.round(Math.max(Math.min(255, color * 255))) * 4
      let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
      if (isNeg) {
        rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
      }
      const pt = vec3.fromValues(nodes[i].x, nodes[i].y, nodes[i].z)

      NiivueObject3D.makeColoredSphere(pts, tris, rgba255, radius, pt, rgba)
    }

    lut = cmapper.colormap(this.edgeColormap, this.colormapInvert)
    lutNeg = cmapper.colormap(this.edgeColormapNegative, this.colormapInvert)
    hasNeg = 'edgeColormapNegative' in this
    min = this.edgeMin
    max = this.edgeMax

    // TODO fix edge types
    const edges = this.edges as NVConnectomeEdge[]
    for (const edge of edges) {
      let color = edge.colorValue
      const isNeg = hasNeg && color < 0
      if (isNeg) {
        color = -color
      }
      const radius = color * this.edgeScale
      if (radius <= 0) {
        continue
      }
      if (min < max) {
        if (color < min) {
          continue
        }
        color = (color - min) / (max - min)
      } else {
        color = 1.0
      }
      color = Math.round(Math.max(Math.min(255, color * 255))) * 4
      let rgba = [lut[color], lut[color + 1], lut[color + 2], 255]
      if (isNeg) {
        rgba = [lutNeg[color], lutNeg[color + 1], lutNeg[color + 2], 255]
      }
      const pti = vec3.fromValues(nodes[edge.first].x, nodes[edge.first].y, nodes[edge.first].z)
      const ptj = vec3.fromValues(nodes[edge.second].x, nodes[edge.second].y, nodes[edge.second].z)
      NiivueObject3D.makeColoredCylinder(pts, tris, rgba255, pti, ptj, radius, rgba)
    }

    const pts32 = new Float32Array(pts)
    const tris32 = new Uint32Array(tris)
    // calculate spatial extent of connectome: user adjusting node sizes may influence size
    const obj = NVMeshUtilities.getExtents(pts32)

    this.furthestVertexFromOrigin = obj.mxDx
    this.extentsMin = obj.extentsMin
    this.extentsMax = obj.extentsMax
    const posNormClr = this.generatePosNormClr(pts32, tris32, new Uint8Array(rgba255))
    // generate webGL buffers and vao
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint32Array.from(tris32), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(posNormClr), gl.STATIC_DRAW)
    this.indexCount = tris.length
  }

  updateMesh(gl: WebGL2RenderingContext): void {
    this.updateConnectome(gl)
    this.updateLabels()
  }

  json(): Connectome {
    const json: Partial<Connectome> = {}
    for (const prop in this) {
      if (prop in defaultOptions || prop === 'nodes' || prop === 'edges') {
        // @ts-expect-error this is not very ethical; returning every field explicitly would probably be better
        json[prop as keyof Connectome] = this[prop]
      }
    }
    return json as Connectome
  }

  /**
   * Factory method to create connectome from options
   */
  static async loadConnectomeFromUrl(gl: WebGL2RenderingContext, url: string): Promise<NVConnectome> {
    const response = await fetch(url)
    const json = await response.json()
    return new NVConnectome(gl, json)
  }
}
