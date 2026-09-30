<script lang="ts">
  import { RfBucket, LatticeDesigner, ColliderDashboard, Fill } from '$lib/widgets/machine';
  import { TriggerGame } from '$lib/widgets/trigger';
</script>

<div class="lab">
  <TriggerGame n="27.4" caption="A test caption for the trigger game." />
  <ColliderDashboard n="21.3" caption="A test caption for the dashboard." />
  <ColliderDashboard mode="lep" n="21.4" caption="LEP." />
  <Fill n="21.5" caption="Fill." />
  <RfBucket n="19.4" caption="A test caption for the RF bucket." />
</div>
<style>.lab { max-width: 54rem; margin: 1rem auto; padding: 0 1rem; }</style>
