import {MapVariable, PicklistValue, CellVariableValue} from './map-variable.model';

export interface UserPresence {
  userId: number;
  userName: string;
  color: string;
  role: 'OWNER' | 'DM' | 'PLAYER';
}

export interface SelectionState {
  userId: number;
  row: number;
  col: number;
  color: string;
}

export interface FieldFocusState {
  userId: number;
  row: number;
  col: number;
  field: string;
  color: string;
}

export interface FieldFlags {
  isDmOnly: boolean;
  isReadOnly: boolean;
}

export type WsMessage =
  | { type: 'USER_JOINED'; userId: number; userName: string; color: string; role: string }
  | { type: 'USER_LEFT'; userId: number }
  | { type: 'SELECTION'; userId: number; row: number; col: number; color: string }
  | { type: 'FIELD_FOCUS'; userId: number; row: number; col: number; field: string; color: string }
  | { type: 'FIELD_BLUR'; userId: number }
  | {
  type: 'CELL_UPDATE';
  mapId: number;
  row: number;
  col: number;
  field: string;
  fieldFlags: FieldFlags;
  value: string;
  userId: number
}
  | { type: 'MAP_UPDATE'; mapId: number; field: string; fieldFlags: FieldFlags; value: unknown; userId: number }
  | {
  type: 'CELL_VARIABLE_UPDATE';
  mapId: number;
  row: number;
  col: number;
  variableId: string;
  fieldFlags: FieldFlags;
  value: string;
  cleared: boolean;
  userId: number
}
  | { type: 'VARIABLE_CREATED'; mapId: number; variable: MapVariable; userId: number }
  | { type: 'VARIABLE_UPDATED'; mapId: number; variable: MapVariable; userId: number }
  | { type: 'VARIABLE_DELETED'; mapId: number; variableId: string; userId: number }
  | { type: 'PICKLIST_VALUE_ADDED'; mapId: number; variableId: string; picklistValue: PicklistValue; userId: number }
  | { type: 'PICKLIST_VALUE_UPDATED'; mapId: number; variableId: string; picklistValue: PicklistValue; userId: number }
  | { type: 'PICKLIST_VALUE_DELETED'; mapId: number; variableId: string; picklistValueId: string; userId: number }
  | {
  type: 'FULL_STATE';
  mapData: unknown;
  cellData: { row: number; col: number; name: string; variableValues: CellVariableValue[] }[];
  variables: MapVariable[];
  users: UserPresence[];
};
