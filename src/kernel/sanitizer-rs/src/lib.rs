use regex::{RegexSet, RegexBuilder};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Clone)]
pub struct Threat {
    pub pattern: String,
    pub category: String,
    pub severity: String,
}

#[derive(Serialize, Deserialize)]
pub struct SanitizeResult {
    pub safe: bool,
    pub threats: Vec<Threat>,
    pub risk_score: f64,
}

#[wasm_bindgen]
pub struct Sanitizer {
    regex_set: RegexSet,
    patterns: Vec<Threat>,
}

#[wasm_bindgen]
impl Sanitizer {
    #[wasm_bindgen(constructor)]
    pub fn new(patterns_json: &str) -> Result<Sanitizer, JsValue> {
        let patterns: Vec<Threat> = serde_json::from_str(patterns_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse patterns: {}", e)))?;

        let mut regex_strs = Vec::new();
        for p in &patterns {
            regex_strs.push(p.pattern.clone());
        }

        let regex_set = regex::RegexSetBuilder::new(&regex_strs)
            .case_insensitive(true)
            .size_limit(10 * (1 << 20))
            .build()
            .map_err(|e| JsValue::from_str(&format!("Failed to compile regex set: {}", e)))?;

        Ok(Sanitizer { regex_set, patterns })
    }

    #[wasm_bindgen]
    pub fn sanitize(&self, content: &str, trust_multiplier: f64) -> Result<JsValue, JsValue> {
        let mut threats = Vec::new();
        let mut risk_score = 0.0;

        let matches = self.regex_set.matches(content);
        for i in matches.into_iter() {
            let matched_pattern = &self.patterns[i];
            threats.push(matched_pattern.clone());

            let weight = match matched_pattern.severity.as_str() {
                "critical" => 10.0,
                "high" => 5.0,
                "medium" => 3.0,
                "low" => 1.0,
                _ => 0.0,
            };
            risk_score += weight;
        }

        risk_score *= trust_multiplier;
        if risk_score > 100.0 {
            risk_score = 100.0;
        }

        let result = SanitizeResult {
            safe: threats.is_empty(),
            threats,
            risk_score,
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
    }
}
