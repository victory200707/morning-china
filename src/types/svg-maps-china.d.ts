declare module "@svg-maps/china" {
  export interface SvgMapLocation {
    id: string;
    name: string;
    path: string;
  }

  export interface SvgMap {
    label: string;
    viewBox: string;
    locations: SvgMapLocation[];
  }

  const chinaMap: SvgMap;
  export default chinaMap;
}
