export type SensorChannelDefinition = {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  unit: string;
  min?: number;
  max?: number;
  decimals?: number;
};
