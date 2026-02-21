use aho_corasick::{AhoCorasick, MatchKind};
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
    ac: AhoCorasick,
    patterns: Vec<Threat>,
}

#[wasm_bindgen]
impl Sanitizer {
    #[wasm_bindgen(constructor)]
    pub fn new(patterns_json: &str) -> Result<Sanitizer, JsValue> {
        let patterns: Vec<Threat> = serde_json::from_str(patterns_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse patterns: {}", e)))?;

        let mut ac_patterns = Vec::new();
        for p in &patterns {
            ac_patterns.push(p.pattern.clone());
        }

        let ac = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::LeftmostFirst)
            .build(&ac_patterns)
            .map_err(|e| JsValue::from_str(&format!("Failed to build AhoCorasick: {}", e)))?;

        Ok(Sanitizer { ac, patterns })
    }

    #[wasm_bindgen]
    pub fn sanitize(&self, content: &str, trust_multiplier: f64) -> Result<JsValue, JsValue> {
        let mut threats = Vec::new();
        let mut risk_score = 0.0;

        for mat in self.ac.find_iter(content) {
            let matched_pattern = &self.patterns[mat.pattern()];
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
