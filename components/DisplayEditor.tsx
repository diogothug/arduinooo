
import React, { useState } from 'react';
import { DisplaySidebar } from './display/DisplaySidebar';
import { DisplayCanvas } from './display/DisplayCanvas';
import { WidgetPanel } from './display/WidgetPanel';

export const DisplayEditor: React.FC = () => {
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-y-auto lg:overflow-hidden pr-2 custom-scrollbar">
        {/* Left Column: Config */}
        <div className="h-auto lg:h-full lg:overflow-hidden">
            <DisplaySidebar />
        </div>

        {/* Center: Simulator */}
        <div className="min-h-[400px] lg:h-full">
            <DisplayCanvas selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />
        </div>

        {/* Right Column: Properties & List */}
        <div className="h-auto lg:h-full lg:overflow-hidden">
             <WidgetPanel selectedWidgetId={selectedWidgetId} setSelectedWidgetId={setSelectedWidgetId} />
        </div>
    </div>
  );
};
