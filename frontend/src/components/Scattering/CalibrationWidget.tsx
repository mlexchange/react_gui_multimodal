import { useState, useEffect, ReactNode, useCallback } from 'react';
import { unpack } from 'msgpackr';
import { NumberInput } from '@/components/ui';
import { Button } from '@blueskyproject/finch';
import { Tiled, TiledItemLinks } from '@blueskyproject/tiled';
import { CrosshairSimpleIcon, GridFourIcon, AngleIcon } from '@phosphor-icons/react';

import { scatteringIcons } from './icons';
import { CalibrationParams, isCalibrationComplete } from './types';
import { extractContainerPath } from './utils/extractContainerPath';

const tiledUrl = import.meta.env.SCATTERING_TILED_URL;
const tiledApiKey = import.meta.env.SCATTERING_TILED_API_KEY;

// Helper component for icon + label in calibration rows
interface IconLabelProps {
    icon: ReactNode;
    label: string;
}

const IconLabel: React.FC<IconLabelProps> = ({ icon, label }) => (
    <div className="flex flex-col items-center w-28 flex-shrink-0 pt-1">
        {icon}
        <span className="text-sm text-slate-800 text-center mt-1">{label}</span>
    </div>
);

interface CalibrationWidgetProps {
    calibrationParams: CalibrationParams | null;
    onCalibrationUpdate: (params: CalibrationParams) => void;
    experimentType: string;           // 'SAXS' or 'GISAXS'
    maskUri: string | null;
    onMaskUpdate: (maskUri: string | null) => void;
    /** Callback to update mask data (Uint8Array of 0/1 values) */
    onMaskDataUpdate: (data: Uint8Array | null, shape: [number, number] | null) => void;
    /** Expected image width for mask validation */
    expectedImageWidth?: number;
    /** Expected image height for mask validation */
    expectedImageHeight?: number;
}

type MaskStatusType = 'success' | 'warning' | 'error';

// Constants for energy-wavelength conversion
// E (eV) = hc / λ (Å) where hc = 12398.419 eV·Å
const HC_CONSTANT = 12398.419;

// Convert wavelength (Angstrom) to energy (eV)
const wavelengthToEnergy = (wavelength: number): number => {
    if (wavelength <= 0) return 0;
    return HC_CONSTANT / wavelength;
};

// Convert energy (eV) to wavelength (Angstrom)
const energyToWavelength = (energy: number): number => {
    if (energy <= 0) return 0;
    return HC_CONSTANT / energy;
};

export default function CalibrationWidget({
    calibrationParams,
    onCalibrationUpdate,
    experimentType,
    maskUri,
    onMaskUpdate,
    onMaskDataUpdate,
    expectedImageWidth,
    expectedImageHeight,
}: CalibrationWidgetProps) {
    const [isModified, setIsModified] = useState(false);
    const [localParams, setLocalParams] = useState<CalibrationParams>(() =>
        calibrationParams ?? {}
    );
    const [energy, setEnergy] = useState(() =>
        wavelengthToEnergy(calibrationParams?.wavelength ?? 0)
    );
    const [maskStatus, setMaskStatus] = useState<{ message: string; type: MaskStatusType } | null>(null);
    const [calibrationStatus, setCalibrationStatus] = useState<{ message: string; type: MaskStatusType } | null>(null);
    const [pendingMaskUri, setPendingMaskUri] = useState<string | null>(null);
    const [pendingMaskName, setPendingMaskName] = useState<string | null>(null);
    const [showMaskDialog, setShowMaskDialog] = useState(false);

    useEffect(() => {
        setLocalParams(calibrationParams ?? {});
        setEnergy(wavelengthToEnergy(calibrationParams?.wavelength ?? 0));
        setIsModified(false);
    }, [calibrationParams]);

    // Handler for general parameter changes
    const handleParamChange = (paramName: keyof CalibrationParams) => (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setLocalParams(prev => ({
                ...prev,
                [paramName]: numericValue
            }));
            setIsModified(true);
        }
    };

    // Handler for wavelength change - also updates energy
    const handleWavelengthChange = (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setLocalParams(prev => ({
                ...prev,
                wavelength: numericValue
            }));
            setEnergy(wavelengthToEnergy(numericValue));
            setIsModified(true);
        }
    };

    // Handler for energy change - also updates wavelength
    const handleEnergyChange = (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setEnergy(numericValue);
            const newWavelength = energyToWavelength(numericValue);
            setLocalParams(prev => ({
                ...prev,
                wavelength: newWavelength
            }));
            setIsModified(true);
        }
    };

    const handleTiledCalibrationSelection = useCallback(async (links: TiledItemLinks) => {
        const containerPath = extractContainerPath(links.self);
        const calibrationName = containerPath.split('/').pop() || 'calibration';
        console.log('Calibration item selected:', containerPath);

        try {
            const response = await fetch(links.self, {
                headers: {
                    'X-TILED-API-KEY': tiledApiKey,
                },
            });

            if (!response.ok) {
                setCalibrationStatus({
                    message: `Failed to fetch calibration: ${response.statusText}`,
                    type: 'error',
                });
                return;
            }

            const data = await response.json();
            console.log('Calibration data:', data);

            // Check if this is a poni calibration file
            const specs = data?.data?.attributes?.specs || [];
            const isPoni = specs.some((spec: { name: string }) => spec.name === 'poni');

            if (!isPoni) {
                setCalibrationStatus({
                    message: 'Selected item is not a PONI calibration file',
                    type: 'warning',
                });
                return;
            }

            // Extract calibration parameters from metadata
            const metadata = data?.data?.attributes?.metadata;
            if (!metadata) {
                setCalibrationStatus({
                    message: 'No metadata found in calibration file',
                    type: 'warning',
                });
                return;
            }

            const newParams: CalibrationParams = {
                sample_detector_distance: metadata.directDist,
                beam_center_x: metadata.centerX,
                beam_center_y: metadata.centerY,
                pixel_size_x: metadata.pixelX,
                pixel_size_y: metadata.pixelY,
                wavelength: metadata.wavelength,
                tilt: metadata.tilt ?? 0,
                tilt_plan_rotation: metadata.tiltPlanRotation ?? 0,
            };

            console.log('Imported calibration parameters:', newParams);
            setLocalParams(newParams);
            setEnergy(wavelengthToEnergy(metadata.wavelength));
            setIsModified(true);
            setCalibrationStatus({
                message: `Loaded: ${calibrationName}`,
                type: 'success',
            });

            // Try to resolve mask from PONI file
            try {
                const maskResponse = await fetch(
                    `/api/resolve-mask?poni_uri=${encodeURIComponent(containerPath)}`
                );
                if (maskResponse.ok) {
                    const maskData = await maskResponse.json();
                    if (maskData.found && maskData.mask_uri) {
                        // Ask user if they want to load the mask
                        setPendingMaskUri(maskData.mask_uri);
                        setPendingMaskName(maskData.mask_name);
                        setShowMaskDialog(true);
                    } else {
                        console.log('Mask not found:', maskData.message);
                    }
                }
            } catch (maskError) {
                console.warn('Could not resolve mask:', maskError);
            }
        } catch (error) {
            console.error('Error fetching calibration data:', error);
            setCalibrationStatus({
                message: 'Error loading calibration file',
                type: 'error',
            });
        }
    }, []);

    // Handle loading the resolved mask
    const handleLoadResolvedMask = useCallback(async () => {
        if (!pendingMaskUri) return;

        // Build URL with optional dimension parameters
        const params = new URLSearchParams();
        params.set('mask_uri', pendingMaskUri);
        if (expectedImageWidth) params.set('expected_width', String(expectedImageWidth));
        if (expectedImageHeight) params.set('expected_height', String(expectedImageHeight));

        try {
            const response = await fetch(`/api/load-mask-from-tiled?${params}`);
            if (response.ok) {
                // Deserialize msgpack response
                const buffer = await response.arrayBuffer();
                const data = unpack(new Uint8Array(buffer)) as {
                    mask_id: string;
                    mask_uri: string;
                    shape: [number, number];
                    data: Uint8Array;
                    message: string;
                    status: string;
                };

                // Use status and message from backend response
                setMaskStatus({
                    message: data.message,
                    type: data.status as MaskStatusType,
                });

                // Set the mask URI and data
                onMaskUpdate(data.mask_uri);
                onMaskDataUpdate(new Uint8Array(data.data), data.shape);
            } else {
                console.error('Failed to load mask');
                setMaskStatus({
                    message: 'Failed to load mask from server',
                    type: 'error',
                });
            }
        } catch (error) {
            console.error('Error loading mask:', error);
            setMaskStatus({
                message: 'Error loading mask',
                type: 'error',
            });
        } finally {
            setShowMaskDialog(false);
            setPendingMaskUri(null);
            setPendingMaskName(null);
        }
    }, [pendingMaskUri, onMaskUpdate, onMaskDataUpdate, expectedImageWidth, expectedImageHeight]);

    // Handle uploading a mask file
    const handleMaskFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        // Build URL with optional dimension parameters
        const params = new URLSearchParams();
        if (expectedImageWidth) params.set('expected_width', String(expectedImageWidth));
        if (expectedImageHeight) params.set('expected_height', String(expectedImageHeight));
        const url = `/api/upload-mask${params.toString() ? `?${params}` : ''}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                // Deserialize msgpack response
                const buffer = await response.arrayBuffer();
                const data = unpack(new Uint8Array(buffer)) as {
                    mask_id: string;
                    shape: [number, number];
                    data: Uint8Array;
                    message: string;
                    status: string;
                };

                // Use status from backend response
                setMaskStatus({
                    message: data.message,
                    type: data.status as MaskStatusType,
                });

                // Set the mask ID and data
                onMaskUpdate(data.mask_id);
                onMaskDataUpdate(new Uint8Array(data.data), data.shape);
            } else {
                const error = await response.json();
                console.error('Failed to upload mask:', error.detail);
                setMaskStatus({
                    message: `Error: ${error.detail}`,
                    type: 'error',
                });
            }
        } catch (error) {
            console.error('Error uploading mask:', error);
            setMaskStatus({
                message: 'Upload failed',
                type: 'error',
            });
        }

        // Reset the file input
        event.target.value = '';
    }, [onMaskUpdate, onMaskDataUpdate, expectedImageWidth, expectedImageHeight]);

    // Clear mask
    const handleClearMask = useCallback(() => {
        onMaskUpdate(null);
        onMaskDataUpdate(null, null);
        setMaskStatus(null);
    }, [onMaskUpdate, onMaskDataUpdate]);

    const handleSubmit = () => {
        if (isCalibrationComplete(localParams)) {
            onCalibrationUpdate(localParams);
            setIsModified(false);
        }
    };

    // Check if form has enough data to submit
    const canSubmit = isModified && isCalibrationComplete(localParams);

    return (
        <div className="space-y-4">
            {/* Load Calibration Button */}
            <div className="w-full [&_button]:w-full [&_button]:font-medium [&_button]:bg-sky-500 [&_button]:hover:bg-sky-600 [&_button]:ml-0 [&_button]:text-md [&_button]:rounded-xl [&_button]:py-2 [&_button]:px-3">
            <Tiled
                tiledBaseUrl={tiledUrl}
                apiKey={tiledApiKey}
                isButtonMode={true}
                buttonModeText="Load calibration parameters"
                onSelectCallback={handleTiledCalibrationSelection}
            />

            {/* Calibration Status */}
            {calibrationStatus && (
                <div className={`text-sm px-3 py-2 rounded-lg mb-2 ${
                    calibrationStatus.type === 'success'
                        ? 'text-green-600 bg-green-50'
                        : calibrationStatus.type === 'warning'
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-red-600 bg-red-50'
                }`}>
                    {calibrationStatus.message}
                </div>
            )}
            
            </div>


            {/* Row 1: Sample-to-detector distance */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<div className="w-8 h-8">{scatteringIcons.sampleDetectorDistance}</div>}
                    label="SDD"
                />
                <div className="flex-1">
                    <NumberInput
                        label="Sample-to-detector distance (mm)"
                        value={localParams.sample_detector_distance ?? ''}
                        onChange={handleParamChange('sample_detector_distance')}
                        decimalScale={2}
                        step={0.1}
                        min={0}
                        size="sm"
                    />
                </div>
            </div>

            {/* Row 2: Wavelength + Energy */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<div className="w-14 h-8">{scatteringIcons.monochromator}</div>}
                    label="Monochromator"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="Wavelength (Å)"
                        value={localParams.wavelength ?? ''}
                        onChange={handleWavelengthChange}
                        decimalScale={4}
                        step={0.0001}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Energy (eV)"
                        value={energy || ''}
                        onChange={handleEnergyChange}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 3: Beam center X + Y */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<CrosshairSimpleIcon size={32} />}
                    label="Beam center"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="X (px)"
                        value={localParams.beam_center_x ?? ''}
                        onChange={handleParamChange('beam_center_x')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Y (px)"
                        value={localParams.beam_center_y ?? ''}
                        onChange={handleParamChange('beam_center_y')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 4: Pixel size X + Y */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<GridFourIcon size={30} />}
                    label="Pixel size"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="X (μm)"
                        value={localParams.pixel_size_x ?? ''}
                        onChange={handleParamChange('pixel_size_x')}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Y (μm)"
                        value={localParams.pixel_size_y ?? ''}
                        onChange={handleParamChange('pixel_size_y')}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 5: Tilt + Plane rotation */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<AngleIcon size={30} />}
                    label="Detector tilt"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="Tilt (°)"
                        value={localParams.tilt ?? 0}
                        onChange={handleParamChange('tilt')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Plane rotation (°)"
                        value={localParams.tilt_plan_rotation ?? 0}
                        onChange={handleParamChange('tilt_plan_rotation')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 6: Incident Angle (GISAXS only) */}
            {experimentType === 'GISAXS' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <IconLabel
                            icon={<AngleIcon size={30} />}
                            label="Incident angle"
                        />
                        <div className="flex-1">
                            <NumberInput
                                label="Incident angle (°)"
                                value={localParams.incident_angle ?? ''}
                                onChange={handleParamChange('incident_angle')}
                                decimalScale={3}
                                step={0.001}
                                min={0}
                                max={5}
                                size="sm"
                            />
                        </div>
                    </div>
                    {!localParams.incident_angle && (
                        <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            Incident angle is required for GISAXS experiments
                        </div>
                    )}
                </div>
            )}

            {/* Detector Mask */}
            <div className="border-t border-slate-200 pt-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-md font-medium text-sky-950">Detector Mask</span>
                    {maskUri && (
                        <Button
                            text="Clear"
                            size="small"
                            cb={handleClearMask}
                            bgColor="bg-red-500"
                        />
                    )}
                </div>
                {maskStatus ? (
                    <div className={`text-sm px-3 py-2 rounded-lg mb-2 ${
                        maskStatus.type === 'success'
                            ? 'text-green-600 bg-green-50'
                            : maskStatus.type === 'warning'
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-red-600 bg-red-50'
                    }`}>
                        {maskStatus.message}
                    </div>
                ) : maskUri ? (
                    <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg mb-2">
                        Mask loaded
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 mb-2">
                        No mask loaded (pixels with value -1 are automatically masked)
                    </div>
                )}
                <label className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 cursor-pointer transition-colors">
                    <span>Upload mask file</span>
                    <input
                        type="file"
                        accept=".npy,.tiff,.tif,.edf,.cbf,.csv"
                        onChange={handleMaskFileUpload}
                        className="sr-only"
                    />
                </label>
            </div>

            {/* Update Button */}
            <div className="border-t border-slate-200 pt-4 mt-2">
                <Button
                    size="medium"
                    styles="w-full"
                    bgColor={canSubmit ? "bg-sky-500" : "bg-gray-400"}
                    cb={handleSubmit}
                    disabled={!canSubmit}
                    text="Done"
                />
            </div>

            {/* Mask Confirmation Dialog */}
            {showMaskDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                        <h3 className="text-lg font-semibold mb-2">Load Mask?</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Found mask &quot;{pendingMaskName}&quot; associated with this calibration.
                            Would you like to load it?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                text="Skip"
                                size="small"
                                cb={() => {
                                    setShowMaskDialog(false);
                                    setPendingMaskUri(null);
                                    setPendingMaskName(null);
                                }}
                                isSecondary
                            />
                            <Button
                                text="Load Mask"
                                size="small"
                                cb={handleLoadResolvedMask}
                                bgColor="bg-sky-500"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
