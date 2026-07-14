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

export type OsmRelationMember = {
  type: string;
  ref: number;
  role: string;
};

export type OsmRelation = {
  type: "relation";
  id: number;
  members: OsmRelationMember[];
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  version?: number;
  elements: Array<OsmNode | OsmWay | OsmRelation | { type: string; id: number }>;
};
