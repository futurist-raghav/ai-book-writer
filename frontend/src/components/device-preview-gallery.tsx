'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronDown, Grid3x3, Square, Monitor, Smartphone, BookOpen, Printer } from 'lucide-react';

interface DevicePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  width_px: number;
  height_px: number;
  margin_px?: number;
  margin_top_px?: number;
  margin_bottom_px?: number;
  margin_left_px?: number;
  margin_right_px?: number;
  font_size_pt: number;
  line_height: number;
  diagonal_inches: number;
  color_support: boolean;
  typical_font_sizes: number[];
}

interface DevicePreviewGalleryProps {
  bookId: string;
  chapterContent?: string;
  onDeviceSelect?: (device: DevicePreset) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'e-reader': <BookOpen className="w-5 h-5" />,
  'device': <Smartphone className="w-5 h-5" />,
  'print': <Printer className="w-5 h-5" />,
  'digital': <Monitor className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'e-reader': 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  'device': 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  'print': 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  'digital': 'bg-green-50 border-green-200 hover:bg-green-100',
};

export function DevicePreviewGallery({
  bookId,
  chapterContent = 'Chapter content preview...',
  onDeviceSelect,
}: DevicePreviewGalleryProps) {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('e-reader');

  // Fetch device presets
  const { data: presetsData, isLoading: presetsLoading } = useQuery({
    queryKey: ['device-presets'],
    queryFn: async () => {
      const response = await fetch('/api/v1/device-preview/presets');
      if (!response.ok) throw new Error('Failed to fetch device presets');
      return response.json();
    },
  });

  // Fetch device preview config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['device-preview-config', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/device-preview`);
      if (!response.ok) throw new Error('Failed to fetch device preview config');
      return response.json();
    },
  });

  // Update device preview config
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const response = await fetch(`/api/v1/books/${bookId}/device-preview`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update device preview config');
      return response.json();
    },
  });

  const devices = presetsData?.devices || [];
  const categories = presetsData?.categories || {};

  const groupedDevices = devices.reduce((acc: Record<string, DevicePreset[]>, device: DevicePreset) => {
    if (!acc[device.category]) acc[device.category] = [];
    acc[device.category].push(device);
    return acc;
  }, {});

  const handleDeviceToggle = (device: DevicePreset) => {
    setSelectedDevice(device);
    onDeviceSelect?.(device);

    // Update config if device is being enabled
    const enableKey = `${device.id}_enabled`;
    if (!config?.[enableKey]) {
      updateConfigMutation.mutate({
        [enableKey]: true,
      });
    }
  };

  const getDevicePreviewStyle = (device: DevicePreset) => {
    const scale = Math.min(
      (window.innerWidth * 0.6) / device.width_px,
      (window.innerHeight * 0.6) / device.height_px,
      1
    );

    return {
      width: `${device.width_px}px`,
      height: `${device.height_px}px`,
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
    };
  };

  if (presetsLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Gallery Header */}
      <div className="border-b pb-6 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Device Preview Gallery</h2>
        <p className="text-gray-600 dark:text-gray-400">
          See how your book looks on different devices and trim sizes
        </p>
      </div>

      {/* Device Categories */}
      <div className="space-y-6">
        {(Object.entries(groupedDevices) as Array<[string, DevicePreset[]]>).map(([category, categoryDevices]) => {
          const categoryInfo = categories[category] || {};
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {CATEGORY_ICONS[category]}
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {categoryInfo.label || category}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {categoryDevices.length} device{categoryDevices.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Device Grid */}
              {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                  {categoryDevices.map((device: DevicePreset) => (
                    <button
                      key={device.id}
                      onClick={() => handleDeviceToggle(device)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedDevice?.id === device.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                          : `border-gray-200 dark:border-gray-700 ${CATEGORY_COLORS[device.category]}`
                      }`}
                    >
                      {/* Device Info */}
                      <div className="text-left mb-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {device.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {device.description}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <div>
                            <span className="font-semibold">Size:</span> {device.diagonal_inches}"
                          </div>
                          <div>
                            <span className="font-semibold">Resolution:</span> {device.width_px}×
                            {device.height_px}
                          </div>
                          <div>
                            <span className="font-semibold">Font:</span> {device.font_size_pt}pt
                          </div>
                          <div>
                            <span className="font-semibold">Color:</span>{' '}
                            {device.color_support ? '✓' : 'B&W'}
                          </div>
                        </div>
                      </div>

                      {/* Device Size Indicator */}
                      <div className="flex justify-center mb-3">
                        <div
                          className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400"
                          style={{
                            width: Math.max(40, (device.width_px / device.height_px) * 60),
                            height: 60,
                          }}
                        >
                          Preview
                        </div>
                      </div>

                      {/* Font Sizes Info */}
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">Font sizes:</span> {device.typical_font_sizes.join(', ')}{' '}
                        pt
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Device Preview */}
      {selectedDevice && (
        <div className="border-t pt-8 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            Preview: {selectedDevice.name}
          </h3>

          {/* Preview Setup Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Dimensions</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {selectedDevice.width_px} × {selectedDevice.height_px} px
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Diagonal</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {selectedDevice.diagonal_inches}"
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Font Size</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {selectedDevice.font_size_pt}pt
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Line Height</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {selectedDevice.line_height}
              </p>
            </div>
          </div>

          {/* Scrollable Preview Container */}
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-8 flex justify-center overflow-auto max-h-96">
            <div
              style={getDevicePreviewStyle(selectedDevice)}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden flex flex-col"
            >
              {/* Device Frame Content */}
              <div
                className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed dark:text-gray-300"
                style={{ fontSize: `${selectedDevice.font_size_pt / 16}rem` }}
              >
                <p className="mb-4">{chapterContent}</p>
                <p className="text-gray-600 dark:text-gray-400">
                  This is how your content will appear on a {selectedDevice.name} device.
                </p>
              </div>
            </div>
          </div>

          {/* Preview Controls */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = 'Download Preview';
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Download PNG
            </button>
            <button
              onClick={() => {
                // Export as PDF for this device
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={() => setSelectedDevice(null)}
              className="ml-auto px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tips Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Device Preview Tips</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• E-readers: Test margins and line spacing for readability on small screens</li>
          <li>• Print: Verify page breaks and margins match your printing specifications</li>
          <li>• Tablets: Ensure layout adapts well to landscape and portrait orientations</li>
          <li>• Web: Test font rendering and responsive breakpoints across devices</li>
        </ul>
      </div>
    </div>
  );
}
