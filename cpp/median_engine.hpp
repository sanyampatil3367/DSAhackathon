#pragma once
#include <queue>
#include <vector>
#include <cstdint>
#include <vector>
struct EngineSnapshot {
  double median;
  std::uint32_t count;
  int lowerSize;
  int upperSize;
  bool hasLowerRoot;
  bool hasUpperRoot;
  int lowerRoot;
  int upperRoot;
  std::vector<int> lowerValues;
  std::vector<int> upperValues;
  bool orderingValid;
  bool balanceValid;
};
class MedianEngine {
  std::priority_queue<int> lower;
  std::priority_queue<int,std::vector<int>,std::greater<int>> upper;
public:
  double insert(int score);
  double median() const;
  std::uint32_t count() const { return static_cast<std::uint32_t>(lower.size()+upper.size()); }
  int lowerSize() const { return static_cast<int>(lower.size()); }
  int upperSize() const { return static_cast<int>(upper.size()); }
  bool orderingValid() const { return lower.empty()||upper.empty()||lower.top()<=upper.top(); }
  bool balanceValid() const { return lower.size()==upper.size()||lower.size()==upper.size()+1; }
  EngineSnapshot snapshot() const;
  void reset() { lower={}; upper={}; }
};
