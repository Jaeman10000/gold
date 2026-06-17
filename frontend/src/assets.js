// 루트 assets/ 의 분리 에셋을 한 곳에서 import (CLAUDE.md §5: 한 장에 굽지 않음).
import bgMine from '@assets/scene/bg_mine.png'
import veinGold from '@assets/scene/vein_gold.png'
import cartFull from '@assets/scene/cart_full.png'   // 기본
import cartEmpty from '@assets/scene/cart_empty.png'  // 수확 후
import goldSmall from '@assets/scene/gold_small.png'   // 금괴더미(모은 금) — 3단계
import goldMedium from '@assets/scene/gold_medium.png'
import goldLarge from '@assets/scene/gold_large.png'
import minerSwing0 from '@assets/scene/miner_swing_0.png'
import minerSwing1 from '@assets/scene/miner_swing_1.png'
import minerSwing2 from '@assets/scene/miner_swing_2.png'
import minerSwing3 from '@assets/scene/miner_swing_3.png'
import goldIcon from '@assets/scene/gold_icon_hud.png'

import iron from '@assets/emblems/iron.png'
import bronze from '@assets/emblems/bronze.png'
import silver from '@assets/emblems/silver.png'
import gold from '@assets/emblems/gold.png'
import platinum from '@assets/emblems/platinum.png'
import emerald from '@assets/emblems/emerald.png'
import master from '@assets/emblems/master.png'
import grandmaster from '@assets/emblems/grandmaster.png'
import challenger from '@assets/emblems/challenger.png'

export const scene = {
  bgMine,
  veinGold,
  cartFull,
  cartEmpty,
  goldSmall,
  goldMedium,
  goldLarge,
  goldIcon,
  // 일꾼 곡괭이질 4프레임 (0→3). 같은 자리에 겹쳐두고 프레임만 교체.
  minerSwing: [minerSwing0, minerSwing1, minerSwing2, minerSwing3],
}

export const emblems = {
  iron, bronze, silver, gold, platinum, emerald, master, grandmaster, challenger,
}
