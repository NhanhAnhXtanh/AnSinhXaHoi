package com.dth.frw.module.asxh.attachment.api.dto;

import jakarta.validation.constraints.NotNull;

/** Tích / bỏ tích "Đã có phiếu xác nhận của Kho bạc". */
public record TreasuryConfirmationRequest(@NotNull(message = "Thiếu giá trị xác nhận") Boolean confirmed) {
}
