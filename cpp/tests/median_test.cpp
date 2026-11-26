#include "../median_engine.hpp"
#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <vector>

static void check(const std::vector<int>& input, const std::vector<double>& expected) {
  MedianEngine engine;
  for (std::size_t i=0;i<input.size();++i) {
    const double actual=engine.insert(input[i]);
    assert(std::abs(actual-expected[i])<1e-9);
    const auto s=engine.snapshot();
    assert(s.orderingValid && s.balanceValid);
  }
}

int main() {
  check({5},{5});
  check({5,1},{5,3});
  check({2,2,2,2},{2,2,2,2});
  check({-5,10,-1,8},{-5,2.5,-1,3.5});
  check({2147483647,-2147483647-1},{2147483647,-0.5});
  check({12,-5,12,2147483647,-2147483647-1,0,12},{12,3.5,12,12,12,6,12});

  MedianEngine engine;
  std::vector<int> reference;
  std::uint32_t seed=727;
  for(int i=0;i<2500;++i) {
    seed=seed*1664525u+1013904223u;
    std::int32_t signedValue;
    std::memcpy(&signedValue,&seed,sizeof(seed));
    const int score=signedValue;
    const double actual=engine.insert(score);
    reference.push_back(score);
    std::sort(reference.begin(),reference.end());
    const std::size_t n=reference.size();
    const double expected=n%2 ? reference[n/2] : (static_cast<std::int64_t>(reference[n/2-1])+reference[n/2])/2.0;
    assert(std::abs(actual-expected)<1e-9);
    const auto s=engine.snapshot();
    assert(s.orderingValid && s.balanceValid);
  }

  engine.reset();
  for(int i=0;i<100000;++i) {
    const auto score=static_cast<int>(static_cast<std::int64_t>(i)*7919-2147483648LL);
    engine.insert(score);
  }
  const auto stress=engine.snapshot();
  assert(stress.count==100000 && stress.orderingValid && stress.balanceValid);
}
