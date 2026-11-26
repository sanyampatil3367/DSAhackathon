#include "median_engine.hpp"
#include <emscripten/bind.h>
#include <emscripten/val.h>

class WasmMedianEngine {
  MedianEngine engine;
public:
  double insert(int score) { return engine.insert(score); }
  void reset() { engine.reset(); }
  emscripten::val snapshot() const {
    const auto s=engine.snapshot();
    emscripten::val out=emscripten::val::object();
    emscripten::val lower=emscripten::val::array(),upper=emscripten::val::array();
    for(int v:s.lowerValues) lower.call<void>("push",v);
    for(int v:s.upperValues) upper.call<void>("push",v);
    out.set("median",s.median); out.set("count",s.count);
    out.set("lower",s.lowerSize); out.set("upper",s.upperSize);
    out.set("lowerRoot",s.hasLowerRoot?emscripten::val(s.lowerRoot):emscripten::val::null());
    out.set("upperRoot",s.hasUpperRoot?emscripten::val(s.upperRoot):emscripten::val::null());
    out.set("lowerValues",lower); out.set("upperValues",upper);
    out.set("orderingValid",s.orderingValid); out.set("balanceValid",s.balanceValid);
    return out;
  }
};

EMSCRIPTEN_BINDINGS(livescore_median) {
  emscripten::class_<WasmMedianEngine>("WasmMedianEngine")
    .constructor<>()
    .function("insert",&WasmMedianEngine::insert)
    .function("reset",&WasmMedianEngine::reset)
    .function("snapshot",&WasmMedianEngine::snapshot);
}
