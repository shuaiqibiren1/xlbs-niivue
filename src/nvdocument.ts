import { serialize, deserialize } from '@ungap/structured-clone'
import { vec3, vec4 } from 'gl-matrix'
import { NVUtilities } from './nvutilities.js'
import { ImageFromUrlOptions, NVIMAGE_TYPE, NVImage } from './nvimage/index.js'
import { MeshType, NVMesh } from './nvmesh.js'
import { NVLabel3D } from './nvlabel.js'
import { NVConnectome } from './nvconnectome.js'
import { log } from './logger.js'

/**
 * Slice Type
 * @ignore
 */
export enum SLICE_TYPE {
  AXIAL = 0,
  CORONAL = 1,
  SAGITTAL = 2,
  MULTIPLANAR = 3,
  RENDER = 4
}

export enum SHOW_RENDER {
  NEVER = 0,
  ALWAYS = 1,
  AUTO = 2
}

/**
 * Multi-planar layout
 * @ignore
 */
export enum MULTIPLANAR_TYPE {
  AUTO = 0,
  COLUMN = 1,
  GRID = 2,
  ROW = 3
}

/**
 * Drag mode
 * @ignore
 */
export enum DRAG_MODE {
  none = 0,
  contrast = 1,
  measurement = 2,
  pan = 3,
  slicer3D = 4,
  callbackOnly = 5
}

// make mutable type
type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

/**
 * NVConfigOptions
 */
export type NVConfigOptions = {
  // 0 for no text, fraction of canvas min(height,width)
  textHeight: number
  // 0 for no colorbars, fraction of Nifti j dimension
  colorbarHeight: number
  // 0 for no crosshairs
  crosshairWidth: number
  crosshairGap: number
  rulerWidth: number
  show3Dcrosshair: boolean
  backColor: number[]
  crosshairColor: number[]
  fontColor: Float32List
  selectionBoxColor: number[]
  clipPlaneColor: number[]
  clipThick: number
  clipVolumeLow: number[]
  clipVolumeHigh: number[]
  rulerColor: number[]
  // x axis margin around color bar, clip space coordinates
  colorbarMargin: number
  // if true do not calculate cal_min or cal_max if set in image header. If false, always calculate display intensity range.
  trustCalMinMax: boolean
  // keyboard short cut to activate the clip plane
  clipPlaneHotKey: string
  // keyboard shortcut to switch view modes
  viewModeHotKey: string
  doubleTouchTimeout: number
  longTouchTimeout: number
  // default debounce time used in keyup listeners
  keyDebounceTime: number
  isNearestInterpolation: boolean
  atlasOutline: number
  isRuler: boolean
  isColorbar: boolean
  isOrientCube: boolean
  multiplanarPadPixels: number
  // @deprecated
  multiplanarForceRender: boolean
  multiplanarShowRender: SHOW_RENDER
  isRadiologicalConvention: boolean
  // string to allow infinity
  meshThicknessOn2D: number | string
  dragMode: DRAG_MODE
  yoke3Dto2DZoom: boolean
  isDepthPickMesh: boolean
  isCornerOrientationText: boolean
  // sagittal slices can have Y+ going left or right
  sagittalNoseLeft: boolean
  isSliceMM: boolean
  // V1 image overlays can show vectors as per-pixel lines
  isV1SliceShader: boolean
  isHighResolutionCapable: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
  loadingText: string
  isForceMouseClickToVoxelCenters: boolean
  dragAndDropEnabled: boolean
  // drawing disabled by default
  drawingEnabled: boolean
  // sets drawing color. see "drawPt"
  penValue: number
  // does a voxel have 6 (face), 18 (edge) or 26 (corner) neighbors
  floodFillNeighbors: number
  isFilledPen: boolean
  thumbnail: string
  maxDrawUndoBitmaps: number
  sliceType: SLICE_TYPE
  isAntiAlias: boolean | null
  isAdditiveBlend: boolean
  // TODO all following fields were previously not included in the typedef
  // Allow canvas width ahd height to resize (false for fixed size)
  isResizeCanvas: boolean
  meshXRay: number
  limitFrames4D: number
  // if a document has labels the default is to show them
  showLegend: boolean
  legendBackgroundColor: number[]
  legendTextColor: number[]
  multiplanarLayout: MULTIPLANAR_TYPE
  renderOverlayBlend: number
  sliceMosaicString: string
  centerMosaic: boolean
  clickToSegment: boolean
  clickToSegmentRadius: number
  clickToSegmentSteps: number
  clickToSegmentBright: boolean
}

export const DEFAULT_OPTIONS: NVConfigOptions = {
  textHeight: 0.06,
  colorbarHeight: 0.05,
  crosshairWidth: 1,
  crosshairGap: 0,
  rulerWidth: 4,
  show3Dcrosshair: false,
  backColor: [0, 0, 0, 1],
  crosshairColor: [1, 0, 0, 1],
  fontColor: [0.5, 0.5, 0.5, 1],
  selectionBoxColor: [1, 1, 1, 0.5],
  clipPlaneColor: [0.7, 0, 0.7, 0.5],
  clipThick: 2,
  clipVolumeLow: [0, 0, 0],
  clipVolumeHigh: [1.0, 1.0, 1.0],
  rulerColor: [1, 0, 0, 0.8],
  colorbarMargin: 0.05,
  trustCalMinMax: true,
  clipPlaneHotKey: 'KeyC',
  viewModeHotKey: 'KeyV',
  doubleTouchTimeout: 500,
  longTouchTimeout: 1000,
  keyDebounceTime: 50,
  isNearestInterpolation: false,
  isResizeCanvas: true,
  atlasOutline: 0,
  isRuler: false,
  isColorbar: false,
  isOrientCube: false,
  multiplanarPadPixels: 0,
  // @deprecated
  multiplanarForceRender: false,
  multiplanarShowRender: SHOW_RENDER.AUTO, // auto is the same behaviour as multiplanarForceRender: false
  isRadiologicalConvention: false,
  meshThicknessOn2D: Infinity,
  dragMode: DRAG_MODE.contrast,
  yoke3Dto2DZoom: false,
  isDepthPickMesh: false,
  isCornerOrientationText: false,
  sagittalNoseLeft: false,
  isSliceMM: false,
  isV1SliceShader: false,
  isHighResolutionCapable: true,
  logLevel: 'info',
  loadingText: 'waiting for images...',
  isForceMouseClickToVoxelCenters: false,
  dragAndDropEnabled: true,
  drawingEnabled: false,
  penValue: 1,
  floodFillNeighbors: 6,
  isFilledPen: false,
  thumbnail: '',
  maxDrawUndoBitmaps: 8,
  sliceType: SLICE_TYPE.MULTIPLANAR,
  meshXRay: 0.0,
  isAntiAlias: null,
  limitFrames4D: NaN,
  isAdditiveBlend: false,
  showLegend: true,
  legendBackgroundColor: [0.3, 0.3, 0.3, 0.5],
  legendTextColor: [1.0, 1.0, 1.0, 1.0],
  multiplanarLayout: MULTIPLANAR_TYPE.AUTO,
  renderOverlayBlend: 1.0,
  sliceMosaicString: '',
  centerMosaic: false,
  clickToSegment: false,
  clickToSegmentRadius: 2,
  clickToSegmentSteps: 10,
  clickToSegmentBright: true
}

type SceneData = {
  azimuth: number
  elevation: number
  crosshairPos: vec3
  clipPlane: number[]
  clipPlaneDepthAziElev: number[]
  volScaleMultiplier: number
  pan2Dxyzmm: vec4
  clipThick: number
  clipVolumeLow: number[]
  clipVolumeHigh: number[]
}

export const INITIAL_SCENE_DATA = {
  azimuth: 110,
  elevation: 10,
  crosshairPos: vec3.create(),
  clipPlane: [0, 0, 0, 0],
  clipPlaneDepthAziElev: [2, 0, 0],
  volScaleMultiplier: 1.0,
  pan2Dxyzmm: vec4.create(),
  clipThick: 2.0,
  clipVolumeLow: [0, 0, 0],
  clipVolumeHigh: [1.0, 1.0, 1.0]
}

export type Scene = {
  onAzimuthElevationChange: (azimuth: number, elevation: number) => void
  onZoom3DChange: (scale: number) => void
  sceneData: SceneData
  renderAzimuth: number
  renderElevation: number
  volScaleMultiplier: number
  crosshairPos: vec3
  clipPlane: number[]
  clipPlaneDepthAziElev: number[]
  pan2Dxyzmm: vec4
  _elevation?: number
  _azimuth?: number
}

export type DocumentData = {
  title: string
  imageOptionsArray: ImageFromUrlOptions[]
  meshOptionsArray: unknown[]
  opts: NVConfigOptions
  previewImageDataURL: string
  labels: NVLabel3D[]
  encodedImageBlobs: string[]
  encodedDrawingBlob: string
  // TODO not sure if they should be here? They are needed for loadFromJSON
  meshesString?: string
  sceneData?: SceneData
  // TODO referenced in niivue/loadDocument
  connectomes?: string[]
  customData?: string
}

export type ExportDocumentData = {
  // base64 encoded images
  encodedImageBlobs: string[]
  // base64 encoded drawing
  encodedDrawingBlob: string
  // dataURL of the preview image
  previewImageDataURL: string
  // map of image ids to image options
  imageOptionsMap: Map<string, number>
  // array of image options to recreate images
  imageOptionsArray: ImageFromUrlOptions[]
  // data to recreate a scene
  sceneData: Partial<SceneData>
  // configuration options of {@link Niivue} instance
  opts: NVConfigOptions
  // encoded meshes
  meshesString: string
  // TODO the following fields were missing in the typedef
  labels: NVLabel3D[]
  connectomes: string[]
  customData: string
}

/**
 * Creates and instance of NVDocument
 * @ignore
 */
export class NVDocument {
  data: DocumentData = {
    title: 'Untitled document',
    imageOptionsArray: [],
    meshOptionsArray: [],
    opts: { ...DEFAULT_OPTIONS },
    previewImageDataURL: '',
    labels: [],
    encodedImageBlobs: [],
    encodedDrawingBlob: ''
  }

  scene: Scene

  volumes: NVImage[] = []
  meshDataObjects?: Array<NVMesh | NVConnectome>
  meshes: Array<NVMesh | NVConnectome> = []
  drawBitmap: Uint8Array | null = null
  imageOptionsMap = new Map()
  meshOptionsMap = new Map()

  constructor() {
    this.scene = {
      onAzimuthElevationChange: (): void => {},
      onZoom3DChange: (): void => {},
      sceneData: {
        ...INITIAL_SCENE_DATA,
        pan2Dxyzmm: vec4.fromValues(0, 0, 0, 1),
        crosshairPos: vec3.fromValues(0.5, 0.5, 0.5)
      },

      get renderAzimuth(): number {
        return this.sceneData.azimuth
      },
      set renderAzimuth(azimuth: number) {
        this.sceneData.azimuth = azimuth
        if (this.onAzimuthElevationChange) {
          this.onAzimuthElevationChange(this.sceneData.azimuth, this.sceneData.elevation)
        }
      },

      get renderElevation(): number {
        return this.sceneData.elevation
      },
      set renderElevation(elevation: number) {
        this.sceneData.elevation = elevation
        if (this.onAzimuthElevationChange) {
          this.onAzimuthElevationChange(this.sceneData.azimuth, this.sceneData.elevation)
        }
      },

      get volScaleMultiplier(): number {
        return this.sceneData.volScaleMultiplier
      },
      set volScaleMultiplier(scale: number) {
        this.sceneData.volScaleMultiplier = scale
        this.onZoom3DChange(scale)
      },

      get crosshairPos(): vec3 {
        return this.sceneData.crosshairPos
      },
      set crosshairPos(crosshairPos: vec3) {
        this.sceneData.crosshairPos = crosshairPos
      },

      get clipPlane(): number[] {
        return this.sceneData.clipPlane
      },
      set clipPlane(clipPlane) {
        this.sceneData.clipPlane = clipPlane
      },

      get clipPlaneDepthAziElev(): number[] {
        return this.sceneData.clipPlaneDepthAziElev
      },
      set clipPlaneDepthAziElev(clipPlaneDepthAziElev: number[]) {
        this.sceneData.clipPlaneDepthAziElev = clipPlaneDepthAziElev
      },

      get pan2Dxyzmm(): vec4 {
        return this.sceneData.pan2Dxyzmm
      },

      /**
       * Sets current 2D pan in 3D mm
       */
      set pan2Dxyzmm(pan2Dxyzmm) {
        this.sceneData.pan2Dxyzmm = pan2Dxyzmm
      }
    }
  }

  /**
   * Title of the document
   */
  get title(): string {
    return this.data.title
  }

  /**
   * Gets preview image blob
   * @returns dataURL of preview image
   */
  get previewImageDataURL(): string {
    return this.data.previewImageDataURL
  }

  /**
   * Sets preview image blob
   * @param dataURL - encoded preview image
   */
  set previewImageDataURL(dataURL: string) {
    this.data.previewImageDataURL = dataURL
  }

  /**
   * @param title - title of document
   */
  set title(title: string) {
    this.data.title = title
  }

  get imageOptionsArray(): ImageFromUrlOptions[] {
    return this.data.imageOptionsArray
  }

  /**
   * Gets the base 64 encoded blobs of associated images
   */
  get encodedImageBlobs(): string[] {
    return this.data.encodedImageBlobs
  }

  /**
   * Gets the base 64 encoded blob of the associated drawing
   * TODO the return type was marked as string[] here, was that an error?
   */
  get encodedDrawingBlob(): string {
    return this.data.encodedDrawingBlob
  }

  /**
   * Gets the options of the {@link Niivue} instance
   */
  get opts(): NVConfigOptions {
    return this.data.opts
  }

  /**
   * Sets the options of the {@link Niivue} instance
   */
  set opts(opts) {
    this.data.opts = { ...opts }
  }

  /**
   * Gets the 3D labels of the {@link Niivue} instance
   */
  get labels(): NVLabel3D[] {
    return this.data.labels
  }

  /**
   * Sets the 3D labels of the {@link Niivue} instance
   */
  set labels(labels: NVLabel3D[]) {
    this.data.labels = labels
  }

  get customData(): string | undefined {
    return this.data.customData
  }

  set customData(data: string) {
    this.data.customData = data
  }

  /**
   * Checks if document has an image by id
   */
  hasImage(image: NVImage): boolean {
    return this.volumes.find((i) => i.id === image.id) !== undefined
  }

  /**
   * Checks if document has an image by url
   */
  hasImageFromUrl(url: string): boolean {
    return this.data.imageOptionsArray.find((i) => i.url === url) !== undefined
  }

  /**
   * Adds an image and the options an image was created with
   */
  addImageOptions(image: NVImage, imageOptions: ImageFromUrlOptions): void {
    if (!this.hasImage(image)) {
      if (!imageOptions.name) {
        if (imageOptions.url) {
          const absoluteUrlRE = /^(?:[a-z+]+:)?\/\//i
          const url = absoluteUrlRE.test(imageOptions.url)
            ? new URL(imageOptions.url)
            : new URL(imageOptions.url, window.location.href)

          imageOptions.name = url.pathname.split('/').pop()! // TODO guaranteed?
          if (imageOptions.name.toLowerCase().endsWith('.gz')) {
            imageOptions.name = imageOptions.name.slice(0, -3)
          }

          if (!imageOptions.name.toLowerCase().endsWith('.nii')) {
            imageOptions.name += '.nii'
          }
        } else {
          imageOptions.name = 'untitled.nii'
        }
      }
    }

    imageOptions.imageType = NVIMAGE_TYPE.NII

    this.data.imageOptionsArray.push(imageOptions)
    this.imageOptionsMap.set(image.id, this.data.imageOptionsArray.length - 1)
  }

  /**
   * Removes image from the document as well as its options
   */
  removeImage(image: NVImage): void {
    if (this.imageOptionsMap.has(image.id)) {
      const index = this.imageOptionsMap.get(image.id)
      if (this.data.imageOptionsArray.length > index) {
        this.data.imageOptionsArray.splice(index, 1)
      }
      this.imageOptionsMap.delete(image.id)
    }
    this.volumes = this.volumes.filter((i) => i.id !== image.id)
  }

  /**
   * Returns the options for the image if it was added by url
   */
  getImageOptions(image: NVImage): ImageFromUrlOptions | null {
    return this.imageOptionsMap.has(image.id) ? this.data.imageOptionsArray[this.imageOptionsMap.get(image.id)] : null
  }

  /**
   * Converts NVDocument to JSON
   */
  json(): ExportDocumentData {
    const data: Partial<ExportDocumentData> = {
      encodedImageBlobs: [],
      previewImageDataURL: this.data.previewImageDataURL,
      imageOptionsMap: new Map()
    }
    const imageOptionsArray = []
    // save our scene object
    data.sceneData = { ...this.scene.sceneData }
    // save our options
    data.opts = { ...this.opts }
    // infinity is a symbol
    if (this.opts.meshThicknessOn2D === Infinity) {
      data.opts.meshThicknessOn2D = 'infinity'
    }

    data.labels = [...this.data.labels]
    data.customData = this.customData

    // volumes
    // TODO move this to a per-volume export function in NVImage?
    if (this.volumes.length) {
      let imageOptions = this.imageOptionsArray[0]
      if (!imageOptions) {
        log.debug('no image options for base image')
        imageOptions = {
          name: '',
          colormap: 'gray',
          opacity: 1.0,
          pairedImgData: null,
          cal_min: NaN,
          cal_max: NaN,
          trustCalMinMax: true,
          percentileFrac: 0.02,
          ignoreZeroVoxels: false,
          useQFormNotSForm: false,
          colormapNegative: '',
          colormapLabel: null,
          imageType: NVIMAGE_TYPE.NII,
          frame4D: 0,
          limitFrames4D: NaN,
          // TODO the following fields were previously not included
          url: '',
          urlImageData: '',
          alphaThreshold: false,
          cal_minNeg: NaN,
          cal_maxNeg: NaN,
          colorbarVisible: true
        }
      }

      // update image options on current image settings
      imageOptions.colormap = this.volumes[0].colormap
      imageOptions.opacity = this.volumes[0].opacity
      imageOptions.cal_max = this.volumes[0].cal_max || NaN
      imageOptions.cal_min = this.volumes[0].cal_min || NaN

      if (imageOptions) {
        imageOptionsArray.push(imageOptions)
        const encodedImageBlob = NVUtilities.uint8tob64(this.volumes[0].toUint8Array())
        data.encodedImageBlobs!.push(encodedImageBlob)
        if (this.drawBitmap) {
          data.encodedDrawingBlob = NVUtilities.uint8tob64(this.volumes[0].toUint8Array(this.drawBitmap))
        }

        data.imageOptionsMap!.set(this.volumes[0].id, 0)
      } else {
        throw new Error('image options for base layer not found')
      }

      for (let i = 1; i < this.volumes.length; i++) {
        const volume = this.volumes[i]
        let imageOptions = this.getImageOptions(volume)

        if (imageOptions === null) {
          log.warn('no options found for image, using default')
          imageOptions = {
            name: '',
            colormap: 'gray',
            opacity: 1.0,
            pairedImgData: null,
            cal_min: NaN,
            cal_max: NaN,
            trustCalMinMax: true,
            percentileFrac: 0.02,
            ignoreZeroVoxels: false,
            useQFormNotSForm: false,
            colormapNegative: '',
            colormapLabel: null,
            imageType: NVIMAGE_TYPE.NII,
            frame4D: 0,
            limitFrames4D: NaN,
            // TODO the following were missing
            url: '',
            urlImageData: '',
            alphaThreshold: false,
            cal_minNeg: NaN,
            cal_maxNeg: NaN,
            colorbarVisible: true
          }
        } else {
          if (!('imageType' in imageOptions)) {
            imageOptions.imageType = NVIMAGE_TYPE.NII
          }
        }
        // update image options on current image settings
        imageOptions.colormap = volume.colormap
        imageOptions.colormapLabel = volume.colormapLabel
        imageOptions.opacity = volume.opacity
        imageOptions.cal_max = volume.cal_max || NaN
        imageOptions.cal_min = volume.cal_min || NaN

        imageOptionsArray.push(imageOptions)

        const encodedImageBlob = NVUtilities.uint8tob64(volume.toUint8Array())
        data.encodedImageBlobs!.push(encodedImageBlob)
        data.imageOptionsMap!.set(volume.id, i)
      }
    }
    // Add it even if it's empty
    data.imageOptionsArray = [...imageOptionsArray]

    // meshes
    const meshes = []
    data.connectomes = []
    for (const mesh of this.meshes) {
      if (mesh.type === MeshType.CONNECTOME) {
        data.connectomes.push(JSON.stringify((mesh as NVConnectome).json()))
        continue
      }
      const copyMesh: Mutable<any> = {
        pts: mesh.pts,
        tris: mesh.tris,
        name: mesh.name,
        rgba255: Uint8Array.from(mesh.rgba255),
        opacity: mesh.opacity,
        connectome: mesh.connectome,
        dpg: mesh.dpg,
        dps: mesh.dps,
        dpv: mesh.dpv,
        meshShaderIndex: mesh.meshShaderIndex,
        layers: mesh.layers.map((layer) => ({
          values: layer.values,
          nFrame4D: layer.nFrame4D,
          frame4D: 0,
          outlineBorder: layer.outlineBorder,
          global_min: layer.global_min,
          global_max: layer.global_max,
          cal_min: layer.cal_min,
          cal_max: layer.cal_max,
          opacity: layer.opacity,
          colormap: layer.colormap,
          colormapNegative: layer.colormapNegative,
          colormapLabel: layer.colormapLabel,
          useNegativeCmap: layer.useNegativeCmap
        })),
        hasConnectome: mesh.hasConnectome,
        edgeColormap: mesh.edgeColormap,
        edgeColormapNegative: mesh.edgeColormapNegative,
        edgeMax: mesh.edgeMax,
        edgeMin: mesh.edgeMin,
        edges: mesh.edges && Array.isArray(mesh.edges) ? [...mesh.edges] : [],
        extentsMax: mesh.extentsMax,
        extentsMin: mesh.extentsMin,
        furthestVertexFromOrigin: mesh.furthestVertexFromOrigin,
        nodeColormap: mesh.nodeColormap,
        nodeColormapNegative: mesh.nodeColormapNegative,
        nodeMaxColor: mesh.nodeMaxColor,
        nodeMinColor: mesh.nodeMinColor,
        nodeScale: mesh.nodeScale,
        legendLineThickness: mesh.legendLineThickness,
        offsetPt0: mesh.offsetPt0,
        nodes: mesh.nodes
      }
      if (mesh.offsetPt0 && mesh.offsetPt0.length > 0) {
        copyMesh.offsetPt0 = mesh.offsetPt0
        copyMesh.fiberGroupColormap = mesh.fiberGroupColormap
        copyMesh.fiberColor = mesh.fiberColor
        copyMesh.fiberDither = mesh.fiberDither
        copyMesh.fiberRadius = mesh.fiberRadius
        copyMesh.colormap = mesh.colormap
      }
      meshes.push(copyMesh)
    }
    data.meshesString = JSON.stringify(serialize(meshes))
    return data as ExportDocumentData
  }

  /**
   * Downloads a JSON file with options, scene, images, meshes and drawing of {@link Niivue} instance
   */
  async download(fileName: string, compress: boolean): Promise<void> {
    const data = this.json()
    const dataText = JSON.stringify(data)
    const contentType = compress ? 'application/gzip' : 'application/json'
    let content: string | ArrayBuffer

    if (compress) {
      content = await NVUtilities.compressStringToArrayBuffer(dataText)
    } else {
      content = JSON.stringify(data)
    }

    NVUtilities.download(content, fileName, contentType)
  }

  /**
   * Deserialize mesh data objects
   */
  static deserializeMeshDataObjects(document: NVDocument): void {
    if (document.data.meshesString) {
      document.meshDataObjects = deserialize(JSON.parse(document.data.meshesString))
      for (const mesh of document.meshDataObjects!) {
        for (const layer of mesh.layers) {
          if ('colorMap' in layer) {
            layer.colormap = layer.colorMap as string
            delete layer.colorMap
          }
          if ('colorMapNegative' in layer) {
            layer.colormapNegative = layer.colorMapNegative as string
            delete layer.colorMapNegative
          }
        }
      }
    }
  }

  /**
   * Factory method to return an instance of NVDocument from a URL
   */
  static async loadFromUrl(url: string): Promise<NVDocument> {
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    let documentData: DocumentData

    if (NVUtilities.isArrayBufferCompressed(buffer)) {
      // The file is gzip compressed
      const documentText = await NVUtilities.decompressArrayBuffer(buffer)
      documentData = JSON.parse(documentText)
    } else {
      const utf8decoder = new TextDecoder()
      documentData = JSON.parse(utf8decoder.decode(buffer))
    }

    return NVDocument.loadFromJSON(documentData)
  }

  /**
   * Factory method to return an instance of NVDocument from a File object
   */
  static async loadFromFile(file: Blob): Promise<NVDocument> {
    const arrayBuffer = await NVUtilities.readFileAsync(file)
    let dataString: string
    const document = new NVDocument()

    if (NVUtilities.isArrayBufferCompressed(arrayBuffer)) {
      dataString = await NVUtilities.decompressArrayBuffer(arrayBuffer)
    } else {
      const utf8decoder = new TextDecoder()
      dataString = utf8decoder.decode(arrayBuffer)
    }
    document.data = JSON.parse(dataString)

    if (document.data.opts.meshThicknessOn2D === 'infinity') {
      document.data.opts.meshThicknessOn2D = Infinity
    }
    document.scene.sceneData = { ...INITIAL_SCENE_DATA, ...document.data.sceneData }

    NVDocument.deserializeMeshDataObjects(document)
    return document
  }

  /**
   * Factory method to return an instance of NVDocument from JSON
   */
  static loadFromJSON(data: DocumentData): NVDocument {
    const document = new NVDocument()
    document.data = data
    if (document.data.opts.meshThicknessOn2D === 'infinity') {
      document.data.opts.meshThicknessOn2D = Infinity
    }
    document.scene.sceneData = { ...INITIAL_SCENE_DATA, ...data.sceneData }
    NVDocument.deserializeMeshDataObjects(document)
    return document
  }
}
