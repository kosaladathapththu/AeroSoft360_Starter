<?php
namespace App\Services\Sales;

use InvalidArgumentException;

final class SetExpansion
{
    /**
     * @param array<int, array{variant_id:int, quantity:int}> $components
     * @return array<int, array{variant_id:int, quantity:int}>
     */
    public function expand(int $sets, array $components): array
    {
        if ($sets < 1) throw new InvalidArgumentException('Set count must be positive.');
        if ($components === []) throw new InvalidArgumentException('A set template requires components.');

        $result = [];
        foreach ($components as $component) {
            if (!isset($component['variant_id'], $component['quantity']) || $component['variant_id'] < 1 || $component['quantity'] < 1) {
                throw new InvalidArgumentException('Every set component requires a valid variant and quantity.');
            }
            $result[] = ['variant_id' => $component['variant_id'], 'quantity' => $sets * $component['quantity']];
        }
        return $result;
    }
}
