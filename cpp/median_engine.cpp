#include "median_engine.hpp"
double MedianEngine::median() const {
  if(lower.empty()) return 0.0;
  if(lower.size()!=upper.size()) return lower.top();
  return (static_cast<std::int64_t>(lower.top())+static_cast<std::int64_t>(upper.top()))/2.0;
}
EngineSnapshot MedianEngine::snapshot() const {
  auto lowCopy=lower; auto highCopy=upper;
  std::vector<int> lowValues,highValues;
  for(int i=0;i<24&&!lowCopy.empty();++i){lowValues.push_back(lowCopy.top());lowCopy.pop();}
  for(int i=0;i<24&&!highCopy.empty();++i){highValues.push_back(highCopy.top());highCopy.pop();}
  return {median(),count(),lowerSize(),upperSize(),!lower.empty(),!upper.empty(),
    lower.empty()?0:lower.top(),upper.empty()?0:upper.top(),lowValues,highValues,
    orderingValid(),balanceValid()};
}
double MedianEngine::insert(int score) {
  if(lower.empty()||score<=lower.top()) lower.push(score); else upper.push(score);
  if(lower.size()>upper.size()+1) { upper.push(lower.top()); lower.pop(); }
  else if(upper.size()>lower.size()) { lower.push(upper.top()); upper.pop(); }
  if(!orderingValid()||!balanceValid()) throw "heap invariant violation";
  return median();
}
