import React, { useState } from 'react';
import { DisplaySidebar } from './display/DisplaySidebar';
import { DisplayCanvas } from './display/DisplayCanvas';
import { WidgetPanel } from './display/WidgetPanel';

export const DisplayEditor: React.FC = () => {
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto items-start">
        {/* Left Column: Config */}
        <div className="h-auto">
            <DisplaySidebar />
        </div>

        {/* Center: Simulator */}
        <div>
            <DisplayCanvas selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />
        </div>

        {/* Right Column: Properties & List */}
        <div className="h-auto">
             <WidgetPanel selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />
        </div>
    </div>
  );
};