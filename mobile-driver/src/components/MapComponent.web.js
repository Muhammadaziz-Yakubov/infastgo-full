import React from 'react';
import { View } from 'react-native';

export const MapView = ({ children, style }) => {
  return (
    <View style={style}>
      {children}
    </View>
  );
};

export const Marker = ({ children }) => {
  return <>{children}</>;
};

export const Circle = () => {
  return null;
};

export const Polyline = () => {
  return null;
};

export default MapView;
