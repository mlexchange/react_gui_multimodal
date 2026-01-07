import { useState, useEffect, ReactNode } from 'react';
import { NumberInput } from '@/components/ui';
import { Button } from '@blueskyproject/finch';
import { CrosshairSimpleIcon, GridFourIcon, AngleIcon } from '@phosphor-icons/react';

import { scatteringIcons } from './icons';
import { CalibrationParams, isCalibrationComplete } from './types';

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

interface CalibrationAccordionProps {
    calibrationParams: CalibrationParams | null;
    onCalibrationUpdate: (params: CalibrationParams) => void;
    experimentType: string;           // 'SAXS' or 'GISAXS'
}

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

export default function CalibrationAccordion({
    calibrationParams,
    onCalibrationUpdate,
    experimentType,
}: CalibrationAccordionProps) {
    const [isModified, setIsModified] = useState(false);
    const [localParams, setLocalParams] = useState<CalibrationParams>(() =>
        calibrationParams ?? {}
    );
    const [energy, setEnergy] = useState(() =>
        wavelengthToEnergy(calibrationParams?.wavelength ?? 0)
    );

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
            <Button
                size="medium"
                styles="w-full"
                text="Load Calibration"
            />

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
            )}

            {/* Update Button */}
            <Button
                size="medium"
                styles="w-full"
                bgColor={canSubmit ? "bg-sky-500" : "bg-gray-400"}
                cb={handleSubmit}
                disabled={!canSubmit}
                text="Update Calibration"
            />
        </div>
    );
}
