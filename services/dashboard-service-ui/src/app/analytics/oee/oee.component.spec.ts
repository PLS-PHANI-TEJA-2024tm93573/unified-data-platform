import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { AssetService } from 'src/app/services/asset-service.service';
import { OeeComponent } from './oee.component';

describe('OeeComponent', () => {
  let component: OeeComponent;
  let fixture: ComponentFixture<OeeComponent>;
  let assetService: jasmine.SpyObj<AssetService>;

  const productionLine = {
    key: 'line-id',
    label: 'ProductionLine01',
    data: {
      id: 'line-id',
      name: 'ProductionLine01',
      variables: [{ id: 'line-speed', name: 'Speed', dataType: 'number', unit: 'rpm' }]
    },
    children: [
      {
        key: 'packager-id',
        label: 'Packager',
        data: { id: 'packager-id', name: 'Packager', variables: [] },
        children: []
      },
      {
        key: 'other-id',
        label: 'Other Asset',
        data: {
          id: 'other-id',
          name: 'Other Asset',
          variables: [{ id: 'temperature', name: 'Temperature', dataType: 'number', unit: 'C' }]
        },
        children: []
      }
    ]
  };

  beforeEach(async () => {
    assetService = jasmine.createSpyObj<AssetService>('AssetService', ['getAssetHierarchy']);
    assetService.getAssetHierarchy.and.returnValue(of([productionLine]));

    await TestBed.configureTestingModule({
      declarations: [OeeComponent],
      imports: [FormsModule, SelectButtonModule, SelectModule],
      providers: [{ provide: AssetService, useValue: assetService }]
    }).compileComponents();

    fixture = TestBed.createComponent(OeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the hierarchy once and shows only LIVE eligible assets by default', () => {
    expect(assetService.getAssetHierarchy).toHaveBeenCalledTimes(1);
    expect(component.value).toBe('live');
    expect(component.availableAssets.map((asset) => asset.name)).toEqual([
      'ProductionLine01',
      'Packager'
    ]);
    expect(component.availableVariables).toEqual([]);
  });

  it('shows every flattened asset and the selected asset variables in History', () => {
    component.onModeChange('history');

    expect(component.availableAssets.map((asset) => asset.name)).toEqual([
      'ProductionLine01',
      'Packager',
      'Other Asset'
    ]);
    expect(component.availableAssets[1]).toBe(productionLine.children[0].data);

    component.onAssetChange('other-id');
    expect(component.availableVariables).toBe(productionLine.children[1].data.variables);
  });

  it('clears the variable when the asset changes and resets selections when mode changes', () => {
    component.onModeChange('history');
    component.onAssetChange('line-id');
    component.selectedVariableId = 'line-speed';

    component.onAssetChange('other-id');
    expect(component.selectedVariableId).toBeNull();
    expect(component.availableVariables).toBe(productionLine.children[1].data.variables);

    component.selectedVariableId = 'temperature';
    component.onModeChange('live');
    expect(component.selectedAssetId).toBeNull();
    expect(component.selectedVariableId).toBeNull();
    expect(component.availableVariables).toEqual([]);
    expect(component.availableAssets.map((asset) => asset.name)).toEqual([
      'ProductionLine01',
      'Packager'
    ]);
  });
});
