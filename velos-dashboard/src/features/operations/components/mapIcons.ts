import * as L from 'leaflet'

export function createDriverIcon(fill: string, opacity = 1): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:34px;height:34px;border-radius:50%;background:${fill};border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;box-sizing:border-box;opacity:${opacity};">
        <div style="width:8px;height:8px;border-radius:50%;background:#ffffff;"></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

export function createRideIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:30px;height:30px;border-radius:50%;background:#ffffff;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
        <div style="width:12px;height:12px;border-radius:50%;background:${color};"></div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}
