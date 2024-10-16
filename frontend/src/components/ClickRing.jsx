import React, { useState } from "react";

const ClickRing = ({ coord, rect, size, color }) => {
  const { normalX, normalY } = coord;
  const x = normalX * rect.width;
  const y = normalY * rect.height;

  return (
    <div
      className="click-ring"
      key={`${x}${y}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        border: `4px solid ${color}`,
      }}
    ></div>
  );
};

export default ClickRing;
