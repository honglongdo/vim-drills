import { useCallback, useEffect, useRef, useState } from 'react'

// Follows the keyboard's active layer over WebHID, using the raw HID protocol
// ZSA's Oryx firmware module speaks to Oryx live training and Keymapp
// (github.com/zsa/qmk_modules, oryx/oryx.c). Layer keys send nothing to the
// OS, so this is the only way a web page can see them.

const ZSA_VENDOR_ID = 0x3297
// QMK's raw HID interface.
const RAW_USAGE_PAGE = 0xff60
const REPORT_SIZE = 32

const CMD_PAIRING_INIT = 0x01
const CMD_DISCONNECT = 0x03
// Event packet: [EVT_LAYER, layer number, stop byte].
const EVT_LAYER = 0x05

// WebHID isn't in TypeScript's DOM lib; just the parts used here.
type HIDDevice = EventTarget & {
  opened: boolean
  vendorId: number
  collections: { usagePage?: number }[]
  open(): Promise<void>
  close(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
}
type HIDInputReportEvent = Event & { data: DataView }
type HIDConnectionEvent = Event & { device: HIDDevice }
type HID = EventTarget & {
  getDevices(): Promise<HIDDevice[]>
  requestDevice(options: {
    filters: { vendorId?: number; usagePage?: number }[]
  }): Promise<HIDDevice[]>
}

const hid = (navigator as Navigator & { hid?: HID }).hid

const isOryx = (d: HIDDevice) =>
  d.vendorId === ZSA_VENDOR_ID && d.collections.some((c) => c.usagePage === RAW_USAGE_PAGE)

function command(code: number) {
  const data = new Uint8Array(REPORT_SIZE)
  data[0] = code
  return data
}

export function useOryxLayer(onLayer: (layer: number) => void) {
  const [device, setDevice] = useState<HIDDevice | null>(null)
  const onLayerRef = useRef(onLayer)
  useEffect(() => {
    onLayerRef.current = onLayer
  })

  // Stable, so adding it twice (e.g. under StrictMode) doesn't double up.
  const handleReport = useCallback((e: Event) => {
    const { data } = e as HIDInputReportEvent
    if (data.getUint8(0) === EVT_LAYER) onLayerRef.current(data.getUint8(1))
  }, [])

  const attach = useCallback(
    async (d: HIDDevice) => {
      if (!d.opened) await d.open()
      // Listen before pairing: the keyboard replies with the current layer.
      d.addEventListener('inputreport', handleReport)
      await d.sendReport(0, command(CMD_PAIRING_INIT))
      setDevice(d)
    },
    [handleReport],
  )

  // Reconnect to a keyboard the user already allowed on an earlier visit.
  useEffect(() => {
    hid
      ?.getDevices()
      .then((devices) => {
        const d = devices.find(isOryx)
        if (d) return attach(d)
      })
      .catch((err) => console.warn('Moonlander reconnect failed', err))
  }, [attach])

  useEffect(() => {
    if (!device || !hid) return
    const onDisconnect = (e: Event) => {
      if ((e as HIDConnectionEvent).device === device) setDevice(null)
    }
    hid.addEventListener('disconnect', onDisconnect)
    return () => {
      hid.removeEventListener('disconnect', onDisconnect)
      device.removeEventListener('inputreport', handleReport)
      // Unpair so the firmware stops sending events; fails harmlessly if unplugged.
      device
        .sendReport(0, command(CMD_DISCONNECT))
        .then(() => device.close())
        .catch(() => {})
    }
  }, [device, handleReport])

  const connect = useCallback(async () => {
    if (!hid) return
    try {
      const [d] = await hid.requestDevice({
        filters: [{ vendorId: ZSA_VENDOR_ID, usagePage: RAW_USAGE_PAGE }],
      })
      if (d) await attach(d)
    } catch (err) {
      console.warn('Moonlander connect failed', err)
    }
  }, [attach])

  return { supported: !!hid, connected: !!device, connect }
}
