import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const pdfPath = path.resolve('src/lib/assets/docs/Drug dose for Pediatrics (QuickRx).pdf');
const dataBuffer = fs.readFileSync(pdfPath);
const formularyPath = path.resolve('src/lib/data/formulary.json');
const existingFormulary = require(formularyPath);

pdf(dataBuffer).then(function(data) {
    const text = data.text;

    let newDrugs = [];

    const generateId = (generic_name) => generic_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // 1. Parse Anti TB drugs
    const tbMatch = text.match(/Anti TB drugs\s*([\s\S]*?)(\n\s*\n\s*\n|●\s*Weight)/i);
    if (tbMatch) {
        let tbText = tbMatch[1];
        let tbRegex = /●\s*([^:]+):\s*([\d-]+)mg\s*\((\d+)\)/g;
        let match;
        while ((match = tbRegex.exec(tbText)) !== null) {
            newDrugs.push({
                id: generateId(match[1].trim() + "_anti_tb"),
                generic_name: match[1].trim(),
                brand_names: [],
                formulations: [],
                dose_guideline: `${match[2]} mg/kg/day`,
                frequency: "OD",
                calculation_shortcut: null,
                special_instructions: `Typical dose: ${match[3]} mg/kg/day. Anti TB drug.`
            });
        }
        let tbRegex2 = /([A-Z][a-z]+):\s*([\d-]+)mg\s*\((\d+)\)/g;
        while ((match = tbRegex2.exec(tbText)) !== null) {
             if (match[1].trim() === "INH") continue;
             if (!newDrugs.find(d => d.generic_name === match[1].trim())) {
                 newDrugs.push({
                    id: generateId(match[1].trim() + "_anti_tb"),
                    generic_name: match[1].trim(),
                    brand_names: [],
                    formulations: [],
                    dose_guideline: `${match[2]} mg/kg/day`,
                    frequency: "OD",
                    calculation_shortcut: null,
                    special_instructions: `Typical dose: ${match[3]} mg/kg/day. Anti TB drug.`
                 });
             }
        }
    }

    // 2. Parse Antimalarials
    const chloroquineMatch = text.match(/Chloroquine:\s*([\s\S]*?)(Tab\.|Syp\.)([^]+?)\n/i);
    if (chloroquineMatch) {
        newDrugs.push({
            id: 'chloroquine_oral',
            generic_name: 'Chloroquine',
            brand_names: [],
            formulations: ['Tab. 250mg(150mg base)', 'Syp. 80mg(50mg base)/5ml'],
            dose_guideline: '10mg/kg PO on D1, then 7.5mg/kg on D2-D3',
            frequency: "Daily",
            calculation_shortcut: null,
            special_instructions: chloroquineMatch[1].trim().replace(/\n/g, ' ')
        });
    }

    // 3. Parse Oral Tablets/Syrups (the tables at the end of the PDF)
    const tablesSections = text.match(/Name of drugs\s+Dose\s+Strength\/tsf\s+Frequen[ca]y([\s\S]*?)(\n\n\n\n|\Z)/g);

    if (tablesSections) {
        tablesSections.forEach(tableText => {
            const lines = tableText.split('\n');
            let isSkipping = true;
            for (let line of lines) {
                line = line.trim();
                if (line.includes('Name of drugs')) {
                    isSkipping = false;
                    continue;
                }
                if (isSkipping || line === '') continue;

                // Matches format like: "Amoxicillin 20-50 mg/kg/day  125 mg  TDS"
                // Or: "Amoxicillin + Clavulanic Acid 20-50 mg/kg/day  125+31.25mg  TDS"
                const lineRegex = /^([A-Za-z\s\+\(\)]+?)\s+(\d+[\d\-\.\s]*mg\/kg\/[a-z]+)\s+([\d\.\+a-z]+(?:mg)?)\s+([A-Z\/]+)$/i;
                const match = line.match(lineRegex);

                if (match) {
                    const genericName = match[1].trim();
                    const doseGuideline = match[2].trim();
                    const strength = match[3].trim();
                    const frequency = match[4].trim();

                    // Filter out already existing drugs in the formulary to avoid duplicates
                    const existingDrug = existingFormulary.find(d => d.generic_name.toLowerCase() === genericName.toLowerCase());
                    const newDrugExisting = newDrugs.find(d => d.generic_name.toLowerCase() === genericName.toLowerCase());

                    if (!existingDrug && !newDrugExisting) {
                        // Attempt to parse calculation shortcut for common suspensions.
                        // Typically: Dose = Weight * (dose_guideline_per_kg / strength_per_tsf) * 5ml
                        let calculation_shortcut = null;

                        // Parse out simple dose from e.g. "20-50 mg/kg/day" or "10 mg/kg/day"
                        const doseMatch = doseGuideline.match(/^(\d+(?:-\d+)?)\s*mg\/kg\/(day|dose)/);
                        const strengthMatch = strength.match(/^(\d+(?:\.\d+)?)\s*(?:mg)?/);

                        if (doseMatch && strengthMatch) {
                            const doseValues = doseMatch[1].split('-');
                            const avgDose = doseValues.length === 2 ? (parseFloat(doseValues[0]) + parseFloat(doseValues[1])) / 2 : parseFloat(doseValues[0]);
                            const strengthVal = parseFloat(strengthMatch[1]);

                            // Average total dose per day: avgDose * wt
                            // Dose per administration = (avgDose * wt) / number of administrations
                            let adminCount = 1;
                            if (frequency === 'BD') adminCount = 2;
                            else if (frequency === 'TDS') adminCount = 3;
                            else if (frequency === 'QDS') adminCount = 4;

                            // Single dose in mg: (avgDose * wt) / adminCount
                            // Volume in ml: (Single dose in mg / strengthVal) * 5 (assuming 1 tsf = 5ml)
                            const factor = (avgDose / adminCount / strengthVal) * 5;
                            // Only set calculation shortcut if it's a simple mg/kg/day calculation
                            if (doseMatch[2] === 'day') {
                                calculation_shortcut = `(wt * ${factor.toFixed(2)})`;
                            } else if (doseMatch[2] === 'dose') {
                                // If dose is per dose
                                const factorPerDose = (avgDose / strengthVal) * 5;
                                calculation_shortcut = `(wt * ${factorPerDose.toFixed(2)})`;
                            }
                        }

                        newDrugs.push({
                            id: generateId(genericName + "_oral"),
                            generic_name: genericName,
                            brand_names: [],
                            formulations: [`${strength} / 5ml`],
                            dose_guideline: doseGuideline,
                            frequency: frequency,
                            calculation_shortcut: calculation_shortcut,
                            special_instructions: `Oral suspension/tablet. Strength: ${strength}.`
                        });
                    }
                } else if (line.includes('1 TSF per')) {
                    // Extracting the calculation shortcuts directly like "1 TSF per 8 kg weight / dose"
                    // These rules could map to special instructions or shortcuts if we could link them to a drug.
                } else {
                     // For complex lines we couldn't parse neatly, append as a generic drug or skip.
                }
            }
        });
    }

    // Anticonvulsants
    const phenobarbMatch = text.match(/Phenobarbitone\s+5 mg\/kg\/day\s+20 mg\s+BD/i);
    if (phenobarbMatch && !existingFormulary.find(d => d.generic_name.toLowerCase().includes('phenobarbitone'))) {
        newDrugs.push({
             id: "phenobarbitone_oral",
             generic_name: "Phenobarbitone",
             brand_names: [],
             formulations: ["20 mg / 5ml"],
             dose_guideline: "5 mg/kg/day",
             frequency: "BD",
             calculation_shortcut: "(wt * 0.625)", // (5/2)/20 * 5
             special_instructions: "Anticonvulsant."
        });
    }

    // Add them to the existing formulary
    const finalFormulary = [...existingFormulary, ...newDrugs];

    // De-duplicate based on generic name + formulation/id
    const uniqueFormulary = Array.from(new Map(finalFormulary.map(item => [item.id, item])).values());

    console.log(`Added ${uniqueFormulary.length - existingFormulary.length} new drugs. Total: ${uniqueFormulary.length}`);

    fs.writeFileSync(formularyPath, JSON.stringify(uniqueFormulary, null, 2));
    console.log("formulary.json updated successfully.");
});
