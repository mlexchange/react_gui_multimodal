// Handle adding a new linecut
export  const addLinecut = (
    linecutType: string,
    selectedLinecuts: string[],
    setSelectedLinecuts: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        if (!selectedLinecuts.includes(linecutType)) {
          setSelectedLinecuts((prev) => [...prev, linecutType]);
        }
      };

export  const handleExperimentTypeChange = (
    value: string | null,
    setExperimentType: React.Dispatch<React.SetStateAction<string>>,
    setSelectedLinecuts: React.Dispatch<React.SetStateAction<string[]>>,
    ) => {
        if (value !== null) {
          setExperimentType(value);
          if (value === 'GISAXS') {
            setSelectedLinecuts(
              (prev) => prev.filter((linecutType) => linecutType !== 'Azimuthal')
              // selectedLinecuts.filter(
              //   (linecutType) =>
              //     linecutType !== 'Azimuthal' // Remove Azimuthal Integration
              // )
            )
          }
        }
      };
