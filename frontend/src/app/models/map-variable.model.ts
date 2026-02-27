export type VariableDataType = 'TEXT' | 'TEXTAREA' | 'DATE' | 'NUMERIC' | 'PICKLIST';
export type VariableVisibility = 'DM_ONLY' | 'PLAYER_READ' | 'PLAYER_EDIT';
export type NumericDisplayFormat = 'INTEGER' | 'FLOAT' | 'PERCENTAGE';

export interface MapVariable {
  id: string;
  mapId: number;
  name: string;
  dataType: VariableDataType;
  displayFormat?: NumericDisplayFormat | null;
  visibility: VariableVisibility;
  showColorOnCells: boolean;
  sortOrder: number;
  picklistValues?: PicklistValue[];
}

export interface PicklistValue {
  id: string;
  variableId: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface CellVariableValue {
  variableId: string;
  value: string;
}
