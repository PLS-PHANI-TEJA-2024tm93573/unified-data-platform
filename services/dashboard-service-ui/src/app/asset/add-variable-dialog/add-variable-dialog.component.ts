import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AssetService } from 'src/app/services/asset-service.service';

@Component({
  selector: 'app-add-variable-dialog',
  standalone: false,
  templateUrl: './add-variable-dialog.component.html',
  styleUrl: './add-variable-dialog.component.scss'
})
export class AddVariableDialogComponent implements OnInit {

  @Input() displayDialog = false;
  @Input() assetId = '';
  @Output() displayDialogChange = new EventEmitter<boolean>();
  @Output() variableAdded = new EventEmitter<void>();

  variableForm!: FormGroup;
  availableVariables: any[] = [];
  loading = false;
  saving = false;

  constructor(
    private readonly assetService: AssetService,
    private readonly formBuilder: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.variableForm = this.formBuilder.group({
      variableDefinitionId: ['', Validators.required],
      variableId: [{ value: '', disabled: true }],
      unit: [{ value: '', disabled: true }],
    });

    this.variableForm.get('variableDefinitionId')?.valueChanges.subscribe((selectedId: string) => {
      const selectedVariable = this.availableVariables.find(
        (item: any) => item.variableDefinition?.id === selectedId,
      )?.variableDefinition;

      this.variableForm.patchValue({
        variableId: selectedVariable?.id ?? '',
        unit: selectedVariable?.unit ?? '',
      }, { emitEvent: false });
    });

    this.loadAvailableVariables();
  }

  loadAvailableVariables(): void {
    if (!this.assetId) {
      this.availableVariables = [];
      return;
    }

    this.loading = true;
    this.assetService.getAssetDetails(this.assetId).subscribe({
      next: (asset) => {
        forkJoin({
          typeVariables: this.assetService.getAssetTypeVariables(asset.assetType.id),
          assignedVariables: this.assetService.getVaraiblesbyAssetId(this.assetId),
        }).subscribe({
          next: ({ typeVariables, assignedVariables }) => {
            const assignedIds = new Set(
              assignedVariables.map((item: any) => item.variableDefinition?.id),
            );
            this.availableVariables = typeVariables.filter(
              (item: any) => !assignedIds.has(item.variableDefinition?.id),
            );
            this.loading = false;
          },
          error: () => {
            this.availableVariables = [];
            this.loading = false;
          },
        });
      },
      error: () => {
        this.availableVariables = [];
        this.loading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.variableForm.invalid || this.saving) {
      this.variableForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const variableDefinitionId = this.variableForm.value.variableDefinitionId;
    this.assetService.addAssetVariable(this.assetId, variableDefinitionId).subscribe({
      next: () => {
        this.variableAdded.emit();
        this.hideDialog();
        this.saving = false;
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  hideDialog(): void {
    this.displayDialogChange.emit(false);
    this.variableForm.reset();
  }

}
