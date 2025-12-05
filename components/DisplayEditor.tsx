import React, { useState } from 'react';
import { DisplaySidebar } from './display/DisplaySidebar';
import { DisplayCanvas } from './display/DisplayCanvas';
import { WidgetPanel } from './display/WidgetPanel';

export const DisplayEditor: React.FC = () => {
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left Column: Config */}
        <DisplaySidebar />

        {/* Center: Simulator */}
        <DisplayCanvas selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />

        {/* Right Column: Properties & List */}
        <WidgetPanel selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />
    </div>
  );
};
