export type OsmNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

export type OsmWay = {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  version?: number;
  elements: Array<OsmNode | OsmWay | { type: string; id: number }>;
};
