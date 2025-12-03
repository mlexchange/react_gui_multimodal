import { useState, useEffect } from 'react';
import { NumberInput, NumberInputProps } from '@mantine/core';
import { Button } from '@blueskyproject/finch';

interface CalibrationParams {
    sample_detector_distance: number;  // Distance in millimeters
    beam_center_x: number;            // X-coordinate in pixels
    beam_center_y: number;            // Y-coordinate in pixels
    pixel_size_x: number;             // Size in micrometers
    pixel_size_y: number;             // Size in micrometers
    wavelength: number;               // Wavelength in Angstroms
    tilt: number;                     // Detector tilt in degrees
    tilt_plan_rotation: number;       // Tilt plane rotation in degrees
}

interface CalibrationAccordionProps {
    calibrationParams: CalibrationParams;
    onCalibrationUpdate: (params: CalibrationParams) => void;
}

// Define props for our custom input component
interface LargeNumberInputProps extends Omit<NumberInputProps, 'label'> {
    label: string;
    description?: string;
}

// Custom wrapper component for NumberInput with large labels
const LargeNumberInput: React.FC<LargeNumberInputProps> = ({
    label,
    ...numberInputProps
}) => {
    return (
        <>
            <NumberInput {...numberInputProps} label={label} size="sm" classNames={{ 
                  label: 'text-md text-sky-700 font-bold', }} />
        </>
    );
};

export default function CalibrationAccordion({
    calibrationParams,
    onCalibrationUpdate,
}: CalibrationAccordionProps) {
    const [isModified, setIsModified] = useState(false);
    const [localParams, setLocalParams] = useState(calibrationParams);

    useEffect(() => {
        setLocalParams(calibrationParams);
        setIsModified(false);
    }, [calibrationParams]);

    // Handler that accepts Mantine's value type (string | number)
    const handleParamChange = (paramName: keyof CalibrationParams) => (value: string | number) => {
        // Convert string to number if needed and validate
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setLocalParams(prev => ({
                ...prev,
                [paramName]: numericValue
            }));
            setIsModified(true);
        }
    };

    const handleSubmit = () => {
        const isValid = Object.values(localParams).every(value =>
            typeof value === 'number' && !isNaN(value)
        );

        if (isValid) {
            onCalibrationUpdate(localParams);
            setIsModified(false);
        }
    };

    return (
        <div className="space-y-2">
            {/* Sample-Detector Distance */}
            <LargeNumberInput
                label="Sample-detector distance (mm)"
                value={localParams.sample_detector_distance}
                onChange={handleParamChange('sample_detector_distance')}
                decimalScale={2}
                step={0.1}
                min={0}
                className="w-full"
            />

            {/* Beam Center Coordinates */}
            <LargeNumberInput
                label="Beam center X (pixels)"
                value={localParams.beam_center_x}
                onChange={handleParamChange('beam_center_x')}
                decimalScale={2}
                step={0.1}
            />
            <LargeNumberInput
                label="Beam center Y (pixels)"
                value={localParams.beam_center_y}
                onChange={handleParamChange('beam_center_y')}
                decimalScale={2}
                step={0.1}
            />

            {/* Pixel Size */}
            <LargeNumberInput
                label="Pixel size X (μm)"
                value={localParams.pixel_size_x}
                onChange={handleParamChange('pixel_size_x')}
                decimalScale={2}
                step={1}
                min={0}
            />
            <LargeNumberInput
                label="Pixel size Y (μm)"
                value={localParams.pixel_size_y}
                onChange={handleParamChange('pixel_size_y')}
                decimalScale={2}
                step={1}
                min={0}
            />

            {/* Wavelength */}
            <LargeNumberInput
                label="Wavelength (Å)"
                value={localParams.wavelength}
                onChange={handleParamChange('wavelength')}
                decimalScale={2}
                step={0.0001}
                min={0}
            />

            {/* Detector Tilt */}
            <LargeNumberInput
                label="Detector tilt (degrees)"
                value={localParams.tilt}
                onChange={handleParamChange('tilt')}
                decimalScale={2}
                step={0.1}
            />
            <LargeNumberInput
                label="Tilt plane rotation (degrees)"
                value={localParams.tilt_plan_rotation}
                onChange={handleParamChange('tilt_plan_rotation')}
                decimalScale={2}
                step={0.1}
            />

            {/* Update Button */}
            <Button
                size="medium"
                styles="w-full"
                bgColor={isModified ? "bg-sky-500" : "bg-gray-400"}
                cb={handleSubmit}
                disabled={!isModified}
                text="Update Calibration"
            />
        </div>
    );
}
