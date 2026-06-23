// 루트 assets/ 의 분리 에셋을 한 곳에서 import (CLAUDE.md §5: 한 장에 굽지 않음).
import bgMine from '@assets/scene/bg_mine.png'
import gwangmaekPlate from '@assets/scene/new/gwangmaek_plate_clean.png'
import miner1Carry   from '@assets/scene/new/miner_1_carry.png'
import miner2Sawing  from '@assets/scene/new/miner_2_sawing.png'
import miner3Sorting from '@assets/scene/new/miner_3_sorting.png'
import miner4Pickaxe from '@assets/scene/new/miner_4_pickaxe.png'
import chamber1 from '@assets/scene/new/chambers/chamber_1.png'
import chamber2 from '@assets/scene/new/chambers/chamber_2.png'
import chamber3 from '@assets/scene/new/chambers/chamber_3.png'
import chamber4 from '@assets/scene/new/chambers/chamber_4.png'
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
import cart from '@assets/scene/cart.png'           // 레일 위 정적 카트
import gemBlue from '@assets/scene/gem_blue.png'     // 수익률 6단계 광물
import gemPurple from '@assets/scene/gem_purple.png'
import gemGreen from '@assets/scene/gem_green.png'
import gemTeal from '@assets/scene/gem_teal.png'
import gemOrange from '@assets/scene/gem_orange.png'
import gemGold from '@assets/scene/gem_gold.png'

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
  cart,
  // 수익률 6단계 광물 (HoldingChips GEM_TIERS와 연결)
  gemBlue,
  gemPurple,
  gemGreen,
  gemTeal,
  gemOrange,
  gemGold,
  // 일꾼 곡괭이질 4프레임 (0→3). 같은 자리에 겹쳐두고 프레임만 교체.
  minerSwing: [minerSwing0, minerSwing1, minerSwing2, minerSwing3],
}

export const gwangmaek = {
  plate: gwangmaekPlate,
  miners: [miner1Carry, miner2Sawing, miner3Sorting, miner4Pickaxe],
  // 플레이트에서 잘라낸 개별 광굴 4종 (줌아웃 격자 셀 배경)
  chambers: [chamber1, chamber2, chamber3, chamber4],
}

export const emblems = {
  iron, bronze, silver, gold, platinum, emerald, master, grandmaster, challenger,
}
