import type { GeoPoint } from "../domain/solar.js";

export interface Place extends GeoPoint {
  id: string;
  name: string;
  region: string;
}

export const representativePlaces: Place[] = [
  { id: "mohe", name: "漠河", region: "东北高纬", latitude: 52.97, longitude: 122.54 },
  { id: "harbin", name: "哈尔滨", region: "东北平原", latitude: 45.8038, longitude: 126.535 },
  { id: "beijing", name: "北京", region: "华北平原", latitude: 39.9042, longitude: 116.4074 },
  { id: "hohhot", name: "呼和浩特", region: "内蒙古高原", latitude: 40.8415, longitude: 111.7492 },
  { id: "xian", name: "西安", region: "关中平原", latitude: 34.3416, longitude: 108.9398 },
  { id: "wuhan", name: "武汉", region: "长江中游", latitude: 30.5928, longitude: 114.3055 },
  { id: "shanghai", name: "上海", region: "东部海岸", latitude: 31.2304, longitude: 121.4737 },
  { id: "chengdu", name: "成都", region: "四川盆地", latitude: 30.5728, longitude: 104.0668 },
  { id: "kunming", name: "昆明", region: "云贵高原", latitude: 25.0389, longitude: 102.7183 },
  { id: "lhasa", name: "拉萨", region: "青藏高原", latitude: 29.652, longitude: 91.1721 },
  { id: "urumqi", name: "乌鲁木齐", region: "西北内陆", latitude: 43.8256, longitude: 87.6168 },
  { id: "kashgar", name: "喀什", region: "西部边疆", latitude: 39.4704, longitude: 75.9898 },
  { id: "guangzhou", name: "广州", region: "华南", latitude: 23.1291, longitude: 113.2644 },
  { id: "sanya", name: "三亚", region: "南海沿岸", latitude: 18.2528, longitude: 109.5119 },
];
